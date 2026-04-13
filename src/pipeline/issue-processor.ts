import type { RepoConfig, Issue, ProcessingResult, ReviewComment, AIModel, PipelinePhase } from '../types/index.js'
import type { GitHubClient } from '../github/client.js'
import type { AIRouter } from '../ai/router.js'
import type { GitOperations } from '../git/operations.js'
import type { StateManager } from '../config/state.js'
import type { TaskTracker } from '../tui/task-tracker.js'
import { createTempDir, cleanupTempDir, buildBranchName } from '../git/index.js'
import { buildSpecPrompt, buildImplementationPrompt, buildReviewPrompt, buildFollowUpPrompt } from './prompts.js'
import { detectTestCommand, runTests } from './test-runner.js'

export class IssueProcessor {
  constructor(
    private readonly github: GitHubClient,
    private readonly ai: AIRouter,
    private readonly git: GitOperations,
    private readonly state: StateManager,
    private readonly tracker?: TaskTracker,
  ) {}

  private taskId(repo: RepoConfig, issue: Issue, phase: PipelinePhase): string {
    return `${repo.owner}/${repo.name}#${issue.number}:${phase}`
  }

  private emitStart(
    repo: RepoConfig,
    issue: Issue,
    phase: PipelinePhase,
    provider: AIModel,
  ): string {
    const id = this.taskId(repo, issue, phase)
    this.tracker?.start({
      id,
      repo: `${repo.owner}/${repo.name}`,
      issueNumber: issue.number,
      phase,
      provider,
    })
    return id
  }

  private async postStatusComment(
    repo: RepoConfig,
    issue: Issue,
    lines: string[],
  ): Promise<void> {
    try {
      await this.github.postIssueComment(repo.owner, repo.name, issue.number, lines.join('\n').trim())
    } catch {
      // Best effort status reporting only.
    }
  }

  async processIssue(repo: RepoConfig, issue: Issue): Promise<ProcessingResult> {
    const repoFullName = `${repo.owner}/${repo.name}`
    const base = repo.defaultBranch ?? 'main'

    // 1. Skip if already processed
    if (this.state.isIssueProcessed(repoFullName, issue.number)) {
      return {
        issueNumber: issue.number,
        repoFullName,
        success: true,
        isDraft: false,
        testsPassed: false,
        modelUsed: 'ollama',
        filesChanged: [],
      }
    }

    // 2. Check branch conflict
    const branchName = buildBranchName(issue.number, issue.title)
    const branchAlreadyExists = await this.github.branchExists(repo.owner, repo.name, branchName)

    if (branchAlreadyExists) {
      const existingPR = await this.github.fetchOpenPRForBranch(repo.owner, repo.name, branchName)
      if (existingPR !== null) {
        // Open PR exists — skip this issue
        return {
          issueNumber: issue.number,
          repoFullName,
          success: true,
          prUrl: existingPR.url,
          isDraft: existingPR.isDraft,
          testsPassed: false,
          modelUsed: 'ollama',
          filesChanged: [],
        }
      }
      // Orphan branch — delete it and proceed
      await this.github.deleteRemoteBranch(repo.owner, repo.name, branchName)
    }

    // 3. Clone repo to temp dir (try/finally for cleanup)
    const tempDir = createTempDir()
    let aiFailure: Error | null = null
    let modelUsed: AIModel = 'ollama'
    let prUrl: string | undefined
    let prNumber: number | undefined
    let isDraft = false
    let testsPassed = false
    let filesChanged: string[] = []

    try {
      const repoUrl = repo.cloneUrl ?? `https://github.com/${repo.owner}/${repo.name}.git`
      await this.git.clone(repoUrl, tempDir, base)

      // 4. Create branch
      await this.git.createBranch(tempDir, branchName)

      // 5. AI Call 1: generate spec
      let specText = ''
      try {
        const specTaskId = this.emitStart(repo, issue, 'specGeneration', 'claude')
        const specPrompt = buildSpecPrompt(issue)
        const specResult = await this.ai.invokeStructured<{ spec: string }>(specPrompt, {
          type: 'object',
          properties: { spec: { type: 'string' } },
        })
        modelUsed = specResult.model
        specText = specResult.data?.spec ?? specResult.rawOutput
        this.tracker?.complete(specTaskId)
      } catch (err) {
        aiFailure = err instanceof Error ? err : new Error(String(err))
        const failId = this.taskId(repo, issue, 'specGeneration')
        this.tracker?.fail(failId, aiFailure.message)
      }

      // 6. AI Call 2: implement (invokeAgent with workingDir)
      if (aiFailure === null) {
        try {
          const implTaskId = this.emitStart(repo, issue, 'implementation', modelUsed)
          const implPrompt = buildImplementationPrompt(specText, `${repo.owner}/${repo.name}`)
          const implResult = await this.ai.invokeAgent(implPrompt, tempDir)
          modelUsed = implResult.model
          this.tracker?.complete(implTaskId)
        } catch (err) {
          aiFailure = err instanceof Error ? err : new Error(String(err))
          const failId = this.taskId(repo, issue, 'implementation')
          this.tracker?.fail(failId, aiFailure.message)
        }
      }

      // 7. Detect and run tests
      if (aiFailure === null) {
        const testCommand = detectTestCommand(tempDir, repo)
        if (testCommand !== null) {
          const testTaskId = this.emitStart(repo, issue, 'testRun', modelUsed)
          const testResult = runTests(tempDir, testCommand)
          testsPassed = testResult.passed
          if (testsPassed) {
            this.tracker?.complete(testTaskId)
          } else {
            this.tracker?.fail(testTaskId, 'Tests failed')
          }
        }
      }

      // 8. Commit all changes
      const committed = await this.git.commitAll(tempDir, `ai: implement issue #${issue.number} — ${issue.title}`)
      if (!committed) {
        const error = 'AI run produced no commit; skipping PR creation.'
        await this.postStatusComment(repo, issue, [
          `🤖 **AI Implementation Attempt** — Issue #${issue.number}`,
          '',
          '⚠️ No commit was created, so no PR was opened.',
          `**Model used:** ${modelUsed}`,
          `**Tests:** ${testsPassed ? '✅ Passing' : '❌ Failing'}`,
        ])
        return {
          issueNumber: issue.number,
          repoFullName,
          success: false,
          isDraft: false,
          testsPassed,
          modelUsed,
          filesChanged: [],
          error,
        }
      }

      // 9. Push branch
      const pushTaskId = this.emitStart(repo, issue, 'push', modelUsed)
      await this.git.push(tempDir, branchName)
      this.tracker?.complete(pushTaskId)

      // 10. Create PR (regular or draft based on test result and AI failure)
      const prTaskId = this.emitStart(repo, issue, 'prCreation', modelUsed)
      const prTitle = `[AI] ${issue.title}`
      const prBody = aiFailure !== null
        ? `Automated implementation attempt for issue #${issue.number}.\n\n⚠️ AI invocation failed: ${aiFailure.message}`
        : `Automated implementation for issue #${issue.number}.\n\n${issue.body}`

      const prParams = {
        owner: repo.owner,
        name: repo.name,
        title: prTitle,
        body: prBody,
        head: branchName,
        base,
      }

      let prResult: { number: number; url: string; isDraft: boolean }
      if (aiFailure !== null || !testsPassed) {
        isDraft = true
        prResult = await this.github.createDraftPullRequest(prParams)
      } else {
        prResult = await this.github.createPullRequest(prParams)
        isDraft = prResult.isDraft
      }

      prUrl = prResult.url
      prNumber = prResult.number
      this.tracker?.complete(prTaskId)

      // 11. Add ai-generated label
      await this.github.addLabel(repo.owner, repo.name, prNumber, 'ai-generated')

      // If AI failed, also add ai-failed label
      if (aiFailure !== null) {
        await this.github.addLabel(repo.owner, repo.name, prNumber, 'ai-failed')
      }

      // 12. AI Call 3: review PR diff (only if AI didn't fail)
      let reviewComments: ReviewComment[] = []
      if (aiFailure === null) {
        try {
          const reviewTaskId = this.emitStart(repo, issue, 'review', modelUsed)
          const diff = await this.github.getPRDiff(repo.owner, repo.name, prNumber)
          const reviewPrompt = buildReviewPrompt(diff)
          const reviewResult = await this.ai.invokeStructured<{ comments: ReviewComment[] }>(
            reviewPrompt,
            { type: 'object', properties: { comments: { type: 'array' } } },
          )
          modelUsed = reviewResult.model
          reviewComments = reviewResult.data?.comments ?? []
          this.tracker?.complete(reviewTaskId)
        } catch {
          // Review failure is non-fatal
          const failId = this.taskId(repo, issue, 'review')
          this.tracker?.fail(failId, 'Review failed (non-fatal)')
        }

        // 13. Post review comments
        if (reviewComments.length > 0) {
          try {
            await this.github.postReviewComments(repo.owner, repo.name, prNumber, reviewComments)
          } catch {
            // non-fatal
          }

          // 14. AI Call 4: address review (invokeAgent with workingDir)
          try {
            const followUpTaskId = this.emitStart(repo, issue, 'followUp', modelUsed)
            const followUpPrompt = buildFollowUpPrompt(reviewComments)
            const followUpResult = await this.ai.invokeAgent(followUpPrompt, tempDir)
            modelUsed = followUpResult.model
            this.tracker?.complete(followUpTaskId)

            // 15. Commit and push follow-up
            const committedFollowUp = await this.git.commitAll(tempDir, `ai: address review comments for #${issue.number}`)
            if (committedFollowUp) {
              await this.git.push(tempDir, branchName)
            }
          } catch {
            // non-fatal follow-up failure
            const failId = this.taskId(repo, issue, 'followUp')
            this.tracker?.fail(failId, 'Follow-up failed (non-fatal)')
          }
        }
      }

      // 16. Get changed files list
      try {
        filesChanged = await this.git.getChangedFiles(tempDir, `origin/${base}`)
      } catch {
        filesChanged = []
      }

      // 17. Post summary comment on issue
      const commentBody = [
        `🤖 **AI Implementation Attempt** — Issue #${issue.number}`,
        '',
        `**PR:** ${prUrl}`,
        `**Model used:** ${modelUsed}`,
        `**Tests:** ${testsPassed ? '✅ Passing' : '❌ Failing'}`,
        `**Files changed:** ${filesChanged.join(', ') || 'none'}`,
        aiFailure !== null ? `\n⚠️ **AI Error:** ${aiFailure.message}` : '',
      ].join('\n').trim()

      await this.github.postIssueComment(repo.owner, repo.name, issue.number, commentBody)

      // 18. Mark issue as processed in state
      this.state.markIssueProcessed(repoFullName, issue.number)

      return {
        issueNumber: issue.number,
        repoFullName,
        success: true,
        prUrl,
        isDraft,
        testsPassed,
        modelUsed,
        filesChanged,
      }
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err)
      if (prUrl === undefined) {
        await this.postStatusComment(repo, issue, [
          `🤖 **AI Implementation Attempt** — Issue #${issue.number}`,
          '',
          '⚠️ The pipeline failed before opening a PR.',
          `**Model used:** ${modelUsed}`,
          `**Tests:** ${testsPassed ? '✅ Passing' : '❌ Failing'}`,
          `**Error:** ${error}`,
        ])
      }
      const failResult: ProcessingResult = {
        issueNumber: issue.number,
        repoFullName,
        success: false,
        isDraft,
        testsPassed,
        modelUsed,
        filesChanged,
        error,
      }
      if (prUrl !== undefined) failResult.prUrl = prUrl
      return failResult
    } finally {
      cleanupTempDir(tempDir)
    }
  }
}

import { parseArgs } from 'node:util'
import { existsSync } from 'node:fs'
import { GitHubClient } from './github/index.js'
import { ClaudeWrapper, CodexWrapper, OllamaWrapper, AIRouter } from './ai/index.js'
import { StateManager, loadConfig } from './config/index.js'
import { PipelineRunner } from './pipeline/index.js'
import { TaskTracker, startTUI } from './tui/index.js'

export async function run(argv: string[] = process.argv.slice(2)): Promise<number> {
  const { values } = parseArgs({
    args: argv,
    options: {
      config: { type: 'string', default: './repos.json' },
      help: { type: 'boolean', default: false },
      'no-tui': { type: 'boolean', default: false },
    },
    allowPositionals: false,
  })

  if (values.help) {
    console.log(`Usage: gh-issue-pipeline [--config <path>] [--no-tui]`)
    return 0
  }

  const token = process.env['GITHUB_TOKEN']
  if (!token) {
    console.error('Error: GITHUB_TOKEN environment variable is required')
    return 1
  }

  const configPath = values.config ?? './repos.json'
  if (!existsSync(configPath)) {
    console.error(`Error: config file not found: ${configPath}`)
    return 1
  }

  const config = loadConfig(configPath)
  const state = new StateManager('.pipeline-state.json', config.quotaLimits)
  const github = new GitHubClient(token)

  const claudeTimeouts = config.providers?.claude
  const codexTimeouts = config.providers?.codex
  const ollamaTimeouts = config.providers?.ollama

  const ai = new AIRouter(state, {
    claude: new ClaudeWrapper(claudeTimeouts?.timeoutMs, claudeTimeouts?.timeoutMs),
    codex: new CodexWrapper(codexTimeouts?.timeoutMs, codexTimeouts?.timeoutMs),
    ollama: new OllamaWrapper(config.ollamaModel ?? 'qwen2.5-coder:latest', ollamaTimeouts?.timeoutMs),
  })

  const useTUI = !values['no-tui'] && process.stdout.isTTY === true
  let tracker: TaskTracker | undefined
  let tuiHandle: ReturnType<typeof startTUI> | undefined

  if (useTUI) {
    tracker = new TaskTracker()
    tuiHandle = startTUI(tracker, () => {
      process.kill(process.pid, 'SIGINT')
    })
  }

  const runner = new PipelineRunner(config, github, ai, state, tracker)

  try {
    return await runner.run()
  } finally {
    tuiHandle?.unmount()
  }
}

// Only run when invoked directly (not imported in tests)
if (process.argv[1]?.endsWith('index.js')) {
  run().then(code => process.exit(code)).catch(err => {
    console.error('Fatal:', err)
    process.exit(1)
  })
}

import { parseArgs } from 'node:util'
import { existsSync } from 'node:fs'
import { GitHubClient } from './github/index.js'
import { ClaudeWrapper, CodexWrapper, OllamaWrapper, MAPWrapper, AIRouter } from './ai/index.js'
import { StateManager, loadConfig } from './config/index.js'
import { PipelineRunner } from './pipeline/index.js'
import type { AIModel, AIProvider } from './types/index.js'

export async function run(argv: string[] = process.argv.slice(2)): Promise<number> {
  const { values } = parseArgs({
    args: argv,
    options: {
      config: { type: 'string', default: './repos.json' },
      help: { type: 'boolean', default: false },
    },
    allowPositionals: false,
  })

  if (values.help) {
    console.log(`Usage: gh-issue-pipeline [--config <path>]`)
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
  const state = new StateManager('.pipeline-state.json', config.quotaLimits, config.retry)
  const github = new GitHubClient(token)

  const providerChain: AIModel[] = config.providerChain ?? ['claude', 'codex', 'ollama']

  // Only instantiate providers that are in the chain
  const providerFactories: Record<AIModel, () => AIProvider> = {
    claude: () => new ClaudeWrapper(),
    codex: () => new CodexWrapper(),
    ollama: () => new OllamaWrapper(config.ollamaModel ?? 'qwen2.5-coder:latest'),
    map: () => new MAPWrapper(),
  }

  const providers: Partial<Record<AIModel, AIProvider>> = {}
  for (const model of providerChain) {
    const factory = providerFactories[model]
    providers[model] = factory()
  }

  // Auto-detect MAP binary and warn if configured but missing
  if (providerChain.includes('map')) {
    const detection = MAPWrapper.detect()
    if (detection.available) {
      console.log(`[MAP] Detected: ${detection.version ?? 'unknown version'}`)
    } else {
      console.warn(`[MAP] Warning: map binary not found but 'map' is in provider chain. ${detection.hint ?? ''}`)
      console.warn(`[MAP] The pipeline will fall through to the next provider if MAP is unavailable.`)
    }
  }

  const ai = new AIRouter(state, providers, providerChain, config.taskModels)

  const runner = new PipelineRunner(config, github, ai, state)
  return runner.run()
}

// Only run when invoked directly (not imported in tests)
if (process.argv[1]?.endsWith('index.js')) {
  run().then(code => process.exit(code)).catch(err => {
    console.error('Fatal:', err)
    process.exit(1)
  })
}

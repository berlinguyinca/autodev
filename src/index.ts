import { parseArgs } from 'node:util'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'
import { GitHubClient } from './github/index.js'
import { ClaudeWrapper, CodexWrapper, OllamaWrapper, AIRouter } from './ai/index.js'
import { StateManager, loadConfig } from './config/index.js'
import { PipelineRunner } from './pipeline/index.js'
import { StatsDatabase } from './stats/index.js'

export async function run(argv: string[] = process.argv.slice(2)): Promise<number> {
  const { values } = parseArgs({
    args: argv,
    options: {
      config: { type: 'string', default: './repos.json' },
      help: { type: 'boolean', default: false },
      tui: { type: 'boolean', default: false },
      'stats-db': { type: 'string' },
    },
    allowPositionals: false,
  })

  if (values.help) {
    console.log(`Usage: gh-issue-pipeline [--config <path>] [--tui] [--stats-db <path>]`)
    return 0
  }

  const statsDbPath = values['stats-db'] ?? join(homedir(), '.gh-issue-pipeline', 'stats.db')

  if (values.tui) {
    const configPath = values.config ?? './repos.json'
    if (!existsSync(configPath)) {
      console.error(`Error: config file not found: ${configPath}`)
      return 1
    }
    const config = loadConfig(configPath)
    const db = new StatsDatabase(statsDbPath)
    const { start } = await import('./tui/index.js')
    start({ db, config, configPath })
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
  const ai = new AIRouter(state, {
    claude: new ClaudeWrapper(),
    codex: new CodexWrapper(),
    ollama: new OllamaWrapper(config.ollamaModel ?? 'qwen2.5-coder:latest'),
  })

  let statsDb: StatsDatabase | undefined
  try {
    statsDb = new StatsDatabase(statsDbPath)
  } catch {
    console.warn('Warning: could not open stats database; statistics will not be recorded.')
  }

  const runner = new PipelineRunner(config, github, ai, state, statsDb)
  const exitCode = await runner.run()

  statsDb?.close()

  return exitCode
}

// Only run when invoked directly (not imported in tests)
if (process.argv[1]?.endsWith('index.js')) {
  run().then(code => process.exit(code)).catch(err => {
    console.error('Fatal:', err)
    process.exit(1)
  })
}

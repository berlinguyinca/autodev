import blessed from 'blessed'
import type { StatsDatabase } from '../stats/database.js'
import type { PipelineConfig } from '../types/index.js'
import { loadStatisticsData } from './statistics-tab.js'
import { formatRepoList, addRepo, removeRepo, persistConfig } from './repositories-tab.js'

export interface TuiDeps {
  db: StatsDatabase
  config: PipelineConfig
  configPath: string
}

export type TabName = 'statistics' | 'repositories'

export interface TuiState {
  activeTab: TabName
}

export function createInitialState(): TuiState {
  return { activeTab: 'statistics' }
}

export function switchTab(state: TuiState): TuiState {
  return {
    activeTab: state.activeTab === 'statistics' ? 'repositories' : 'statistics',
  }
}

export function buildTabHeader(state: TuiState): string {
  const statsLabel = state.activeTab === 'statistics' ? '[Statistics]' : ' Statistics '
  const reposLabel = state.activeTab === 'repositories' ? '[Repositories]' : ' Repositories '
  return `${statsLabel}  ${reposLabel}  |  Tab: switch  q: quit  r: refresh`
}

export function renderStatisticsContent(db: StatsDatabase): string {
  const data = loadStatisticsData(db)

  const lines: string[] = []
  lines.push('=== Summary ===')
  for (const row of data.summaryRows) {
    lines.push(`  ${row.label}: ${row.value}`)
  }

  lines.push('')
  lines.push('=== Per-Repo Breakdown ===')
  lines.push(`  ${'Repo'.padEnd(30)} ${'Total'.padStart(6)} ${'OK'.padStart(6)} ${'Fail'.padStart(6)} ${'Rate'.padStart(8)}`)
  for (const row of data.repoRows) {
    lines.push(`  ${row.repo.padEnd(30)} ${row.total.padStart(6)} ${row.succeeded.padStart(6)} ${row.failed.padStart(6)} ${row.successRate.padStart(8)}`)
  }

  lines.push('')
  lines.push('=== Per-Model Breakdown ===')
  lines.push(`  ${'Model'.padEnd(15)} ${'Count'.padStart(6)} ${'Rate'.padStart(8)}`)
  for (const row of data.modelRows) {
    lines.push(`  ${row.model.padEnd(15)} ${row.count.padStart(6)} ${row.successRate.padStart(8)}`)
  }

  lines.push('')
  lines.push('=== Recent Activity ===')
  lines.push(`  ${'Repo'.padEnd(25)} ${'Issue'.padStart(7)} ${'Status'.padStart(7)} ${'Model'.padStart(8)} ${'Date'.padStart(20)}`)
  for (const row of data.recentRows) {
    lines.push(`  ${row.repo.padEnd(25)} ${row.issue.padStart(7)} ${row.status.padStart(7)} ${row.model.padStart(8)} ${row.date.padStart(20)}`)
  }

  return lines.join('\n')
}

export function renderRepositoriesContent(config: PipelineConfig): string {
  const items = formatRepoList(config)
  const lines: string[] = []
  lines.push('=== Configured Repositories ===')
  lines.push('  a: add  d: delete  Enter: view')
  lines.push('')

  if (items.length === 0) {
    lines.push('  (no repositories configured)')
  } else {
    for (const [i, item] of items.entries()) {
      lines.push(`  ${i + 1}. ${item.display}`)
    }
  }

  return lines.join('\n')
}

export function start(deps: TuiDeps): void {
  const screen = blessed.screen({
    smartCSR: true,
    title: 'gh-issue-pipeline',
  })

  let state = createInitialState()
  let config = deps.config

  const header = blessed.box({
    top: 0,
    left: 0,
    width: '100%',
    height: 1,
    content: buildTabHeader(state),
    style: { fg: 'white', bg: 'blue' },
  })

  const body = blessed.box({
    top: 1,
    left: 0,
    width: '100%',
    height: '100%-1',
    scrollable: true,
    alwaysScroll: true,
    keys: true,
    vi: true,
    content: '',
  })

  screen.append(header)
  screen.append(body)

  function refresh() {
    header.setContent(buildTabHeader(state))
    if (state.activeTab === 'statistics') {
      body.setContent(renderStatisticsContent(deps.db))
    } else {
      body.setContent(renderRepositoriesContent(config))
    }
    screen.render()
  }

  screen.key(['tab', 'S-tab', '1', '2'], (ch) => {
    if (ch === '1') {
      state = { activeTab: 'statistics' }
    } else if (ch === '2') {
      state = { activeTab: 'repositories' }
    } else {
      state = switchTab(state)
    }
    refresh()
  })

  screen.key(['r'], () => {
    refresh()
  })

  screen.key(['a'], () => {
    if (state.activeTab !== 'repositories') return
    // Prompt for owner/name
    const prompt = blessed.prompt({
      parent: screen,
      top: 'center',
      left: 'center',
      width: '50%',
      height: 'shrink',
      border: 'line',
      style: { border: { fg: 'green' } },
    })
    prompt.input('Add repo (owner/name):', '', (_err, value) => {
      if (value && value.includes('/')) {
        const [owner, name] = value.split('/')
        if (owner && name) {
          config = addRepo(config, { owner, name })
          persistConfig(deps.configPath, config)
          refresh()
        }
      }
      prompt.destroy()
    })
  })

  screen.key(['d'], () => {
    if (state.activeTab !== 'repositories') return
    const prompt = blessed.prompt({
      parent: screen,
      top: 'center',
      left: 'center',
      width: '50%',
      height: 'shrink',
      border: 'line',
      style: { border: { fg: 'red' } },
    })
    prompt.input('Delete repo # (1-based index):', '', (_err, value) => {
      if (value) {
        const idx = parseInt(value, 10) - 1
        if (!isNaN(idx)) {
          config = removeRepo(config, idx)
          persistConfig(deps.configPath, config)
          refresh()
        }
      }
      prompt.destroy()
    })
  })

  screen.key(['q', 'C-c'], () => {
    deps.db.close()
    process.exit(0)
  })

  refresh()
}

import { describe, it, expect } from 'vitest'
import {
  createInitialState,
  switchTab,
  buildTabHeader,
  renderStatisticsContent,
  renderRepositoriesContent,
} from '../../../src/tui/app.js'
import type { PipelineConfig } from '../../../src/types/index.js'
import { StatsDatabase } from '../../../src/stats/database.js'

describe('TUI app logic', () => {
  describe('createInitialState', () => {
    it('starts on the statistics tab', () => {
      const state = createInitialState()
      expect(state.activeTab).toBe('statistics')
    })
  })

  describe('switchTab', () => {
    it('toggles from statistics to repositories', () => {
      const state = switchTab({ activeTab: 'statistics' })
      expect(state.activeTab).toBe('repositories')
    })

    it('toggles from repositories to statistics', () => {
      const state = switchTab({ activeTab: 'repositories' })
      expect(state.activeTab).toBe('statistics')
    })
  })

  describe('buildTabHeader', () => {
    it('highlights statistics tab when active', () => {
      const header = buildTabHeader({ activeTab: 'statistics' })
      expect(header).toContain('[Statistics]')
      expect(header).toContain(' Repositories ')
      expect(header).toContain('Tab: switch')
      expect(header).toContain('q: quit')
    })

    it('highlights repositories tab when active', () => {
      const header = buildTabHeader({ activeTab: 'repositories' })
      expect(header).toContain(' Statistics ')
      expect(header).toContain('[Repositories]')
    })
  })

  describe('renderStatisticsContent', () => {
    it('renders summary, repo, model, and recent sections', () => {
      const db = new StatsDatabase(':memory:')
      db.recordResult({
        issueNumber: 1,
        repoFullName: 'acme/api',
        success: true,
        isDraft: false,
        testsPassed: true,
        modelUsed: 'claude',
        filesChanged: ['a.ts'],
      })

      const content = renderStatisticsContent(db)
      expect(content).toContain('=== Summary ===')
      expect(content).toContain('Total Issues: 1')
      expect(content).toContain('Total Repos: 1')
      expect(content).toContain('Success Rate: 100.0%')
      expect(content).toContain('=== Per-Repo Breakdown ===')
      expect(content).toContain('acme/api')
      expect(content).toContain('=== Per-Model Breakdown ===')
      expect(content).toContain('claude')
      expect(content).toContain('=== Recent Activity ===')

      db.close()
    })

    it('renders empty state without errors', () => {
      const db = new StatsDatabase(':memory:')
      const content = renderStatisticsContent(db)
      expect(content).toContain('Total Issues: 0')
      db.close()
    })
  })

  describe('renderRepositoriesContent', () => {
    it('lists configured repositories', () => {
      const config: PipelineConfig = {
        repos: [
          { owner: 'acme', name: 'api' },
          { owner: 'acme', name: 'web' },
        ],
        ollamaModel: 'qwen2.5-coder:latest',
        maxIssuesPerRun: 10,
      }

      const content = renderRepositoriesContent(config)
      expect(content).toContain('=== Configured Repositories ===')
      expect(content).toContain('1. acme/api')
      expect(content).toContain('2. acme/web')
    })

    it('shows placeholder when no repos configured', () => {
      const config: PipelineConfig = {
        repos: [],
        ollamaModel: 'qwen2.5-coder:latest',
        maxIssuesPerRun: 10,
      }

      const content = renderRepositoriesContent(config)
      expect(content).toContain('(no repositories configured)')
    })
  })
})

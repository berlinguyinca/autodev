import { describe, it, expect } from 'vitest'
import type { StatsSummary } from '../../../src/types/index.js'
import {
  formatSummaryRows,
  formatRepoRows,
  formatModelRows,
  formatRecentRows,
} from '../../../src/tui/statistics-tab.js'
import type { SummaryRow, RepoRow, RecentRow } from '../../../src/tui/statistics-tab.js'

describe('statistics-tab formatting', () => {
  describe('formatSummaryRows', () => {
    it('formats summary with correct labels and values', () => {
      const summary: StatsSummary = {
        totalIssues: 42,
        totalRepos: 5,
        successRate: 0.857,
        byRepo: [],
      }

      const rows = formatSummaryRows(summary)
      expect(rows).toHaveLength(3)
      expect(rows[0]).toEqual({ label: 'Total Issues', value: '42' })
      expect(rows[1]).toEqual({ label: 'Total Repos', value: '5' })
      expect(rows[2]).toEqual({ label: 'Success Rate', value: '85.7%' })
    })

    it('handles zero values', () => {
      const summary: StatsSummary = {
        totalIssues: 0,
        totalRepos: 0,
        successRate: 0,
        byRepo: [],
      }

      const rows = formatSummaryRows(summary)
      expect((rows[0] as SummaryRow).value).toBe('0')
      expect((rows[2] as SummaryRow).value).toBe('0.0%')
    })

    it('handles 100% success rate', () => {
      const summary: StatsSummary = {
        totalIssues: 10,
        totalRepos: 2,
        successRate: 1,
        byRepo: [],
      }

      const rows = formatSummaryRows(summary)
      expect((rows[2] as SummaryRow).value).toBe('100.0%')
    })
  })

  describe('formatRepoRows', () => {
    it('formats per-repo breakdown correctly', () => {
      const summary: StatsSummary = {
        totalIssues: 5,
        totalRepos: 2,
        successRate: 0.6,
        byRepo: [
          { repo: 'acme/api', total: 3, succeeded: 2, failed: 1 },
          { repo: 'acme/web', total: 2, succeeded: 1, failed: 1 },
        ],
      }

      const rows = formatRepoRows(summary)
      expect(rows).toHaveLength(2)
      expect(rows[0]).toEqual({
        repo: 'acme/api',
        total: '3',
        succeeded: '2',
        failed: '1',
        successRate: '66.7%',
      })
      expect(rows[1]).toEqual({
        repo: 'acme/web',
        total: '2',
        succeeded: '1',
        failed: '1',
        successRate: '50.0%',
      })
    })

    it('returns empty array when no repos', () => {
      const summary: StatsSummary = {
        totalIssues: 0,
        totalRepos: 0,
        successRate: 0,
        byRepo: [],
      }

      expect(formatRepoRows(summary)).toEqual([])
    })

    it('handles zero total for a repo', () => {
      const summary: StatsSummary = {
        totalIssues: 0,
        totalRepos: 1,
        successRate: 0,
        byRepo: [{ repo: 'x/y', total: 0, succeeded: 0, failed: 0 }],
      }

      const rows = formatRepoRows(summary)
      expect((rows[0] as RepoRow).successRate).toBe('0.0%')
    })
  })

  describe('formatModelRows', () => {
    it('formats model breakdown correctly', () => {
      const models = [
        { model: 'claude', count: 10, successRate: 0.9 },
        { model: 'codex', count: 5, successRate: 0.6 },
        { model: 'ollama', count: 3, successRate: 0.333 },
      ]

      const rows = formatModelRows(models)
      expect(rows).toHaveLength(3)
      expect(rows[0]).toEqual({ model: 'claude', count: '10', successRate: '90.0%' })
      expect(rows[1]).toEqual({ model: 'codex', count: '5', successRate: '60.0%' })
      expect(rows[2]).toEqual({ model: 'ollama', count: '3', successRate: '33.3%' })
    })

    it('returns empty array for no models', () => {
      expect(formatModelRows([])).toEqual([])
    })
  })

  describe('formatRecentRows', () => {
    it('formats recent activity records', () => {
      const records = [
        { repo: 'acme/api', issueNumber: 42, success: true, modelUsed: 'claude', processedAt: '2025-01-15 10:30:00' },
        { repo: 'acme/web', issueNumber: 13, success: false, modelUsed: 'codex', processedAt: '2025-01-15 09:00:00' },
      ]

      const rows = formatRecentRows(records)
      expect(rows).toHaveLength(2)
      expect(rows[0]).toEqual({
        repo: 'acme/api',
        issue: '#42',
        status: 'OK',
        model: 'claude',
        date: '2025-01-15 10:30:00',
      })
      expect(rows[1]).toEqual({
        repo: 'acme/web',
        issue: '#13',
        status: 'FAIL',
        model: 'codex',
        date: '2025-01-15 09:00:00',
      })
    })

    it('uses "unknown" for null model', () => {
      const records = [
        { repo: 'a/b', issueNumber: 1, success: true, modelUsed: null, processedAt: '2025-01-01' },
      ]

      const rows = formatRecentRows(records)
      expect((rows[0] as RecentRow).model).toBe('unknown')
    })

    it('returns empty array for no records', () => {
      expect(formatRecentRows([])).toEqual([])
    })
  })
})

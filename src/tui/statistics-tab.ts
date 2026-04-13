import type { StatsDatabase } from '../stats/database.js'
import type { StatsSummary } from '../types/index.js'

export interface SummaryRow {
  label: string
  value: string
}

export interface RepoRow {
  repo: string
  total: string
  succeeded: string
  failed: string
  successRate: string
}

export interface ModelRow {
  model: string
  count: string
  successRate: string
}

export interface RecentRow {
  repo: string
  issue: string
  status: string
  model: string
  date: string
}

export function formatSummaryRows(summary: StatsSummary): SummaryRow[] {
  return [
    { label: 'Total Issues', value: String(summary.totalIssues) },
    { label: 'Total Repos', value: String(summary.totalRepos) },
    { label: 'Success Rate', value: `${(summary.successRate * 100).toFixed(1)}%` },
  ]
}

export function formatRepoRows(summary: StatsSummary): RepoRow[] {
  return summary.byRepo.map((r) => ({
    repo: r.repo,
    total: String(r.total),
    succeeded: String(r.succeeded),
    failed: String(r.failed),
    successRate: r.total > 0 ? `${((r.succeeded / r.total) * 100).toFixed(1)}%` : '0.0%',
  }))
}

export function formatModelRows(
  models: Array<{ model: string; count: number; successRate: number }>,
): ModelRow[] {
  return models.map((m) => ({
    model: m.model,
    count: String(m.count),
    successRate: `${(m.successRate * 100).toFixed(1)}%`,
  }))
}

export function formatRecentRows(
  records: Array<{ repo: string; issueNumber: number; success: boolean; modelUsed: string | null; processedAt: string }>,
): RecentRow[] {
  return records.map((r) => ({
    repo: r.repo,
    issue: `#${r.issueNumber}`,
    status: r.success ? 'OK' : 'FAIL',
    model: r.modelUsed ?? 'unknown',
    date: r.processedAt,
  }))
}

export function loadStatisticsData(db: StatsDatabase) {
  const summary = db.summary()
  const models = db.byModel()
  const recent = db.recentResults(20)
  return {
    summaryRows: formatSummaryRows(summary),
    repoRows: formatRepoRows(summary),
    modelRows: formatModelRows(models),
    recentRows: formatRecentRows(recent),
  }
}

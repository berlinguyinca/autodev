import Database from 'better-sqlite3'
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import type { ProcessingResult, StatsRecord, StatsSummary, AIModel } from '../types/index.js'

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS results (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  repo          TEXT    NOT NULL,
  issue_number  INTEGER NOT NULL,
  issue_title   TEXT    NOT NULL DEFAULT '',
  success       INTEGER NOT NULL,
  is_draft      INTEGER NOT NULL DEFAULT 0,
  tests_passed  INTEGER NOT NULL DEFAULT 0,
  model_used    TEXT,
  files_changed INTEGER NOT NULL DEFAULT 0,
  pr_url        TEXT,
  error         TEXT,
  processed_at  TEXT    NOT NULL DEFAULT (datetime('now')),
  UNIQUE(repo, issue_number)
);
`

interface RawRow {
  id: number
  repo: string
  issue_number: number
  issue_title: string
  success: number
  is_draft: number
  tests_passed: number
  model_used: string | null
  files_changed: number
  pr_url: string | null
  error: string | null
  processed_at: string
}

function rowToRecord(row: RawRow): StatsRecord {
  return {
    id: row.id,
    repo: row.repo,
    issueNumber: row.issue_number,
    issueTitle: row.issue_title,
    success: row.success === 1,
    isDraft: row.is_draft === 1,
    testsPassed: row.tests_passed === 1,
    modelUsed: (row.model_used as AIModel | null),
    filesChanged: row.files_changed,
    prUrl: row.pr_url,
    error: row.error,
    processedAt: row.processed_at,
  }
}

export class StatsDatabase {
  private db: Database.Database | null

  constructor(dbPath: string) {
    if (dbPath !== ':memory:') {
      mkdirSync(dirname(dbPath), { recursive: true })
    }
    this.db = new Database(dbPath)
    this.db.pragma('journal_mode = WAL')
    this.db.exec(SCHEMA_SQL)
  }

  recordResult(result: ProcessingResult): void {
    const db = this.ensureOpen()
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO results
        (repo, issue_number, issue_title, success, is_draft, tests_passed,
         model_used, files_changed, pr_url, error)
      VALUES
        (@repo, @issueNumber, @issueTitle, @success, @isDraft, @testsPassed,
         @modelUsed, @filesChanged, @prUrl, @error)
    `)
    stmt.run({
      repo: result.repoFullName,
      issueNumber: result.issueNumber,
      issueTitle: '',
      success: result.success ? 1 : 0,
      isDraft: result.isDraft ? 1 : 0,
      testsPassed: result.testsPassed ? 1 : 0,
      modelUsed: result.modelUsed,
      filesChanged: result.filesChanged.length,
      prUrl: result.prUrl ?? null,
      error: result.error ?? null,
    })
  }

  summary(): StatsSummary {
    const db = this.ensureOpen()

    const totals = db.prepare(`
      SELECT COUNT(*) AS total,
             SUM(success) AS succeeded
      FROM results
    `).get() as { total: number; succeeded: number }

    const repos = db.prepare(`
      SELECT repo,
             COUNT(*) AS total,
             SUM(success) AS succeeded,
             COUNT(*) - SUM(success) AS failed
      FROM results
      GROUP BY repo
      ORDER BY repo
    `).all() as Array<{ repo: string; total: number; succeeded: number; failed: number }>

    const repoCount = db.prepare(`SELECT COUNT(DISTINCT repo) AS cnt FROM results`).get() as { cnt: number }

    return {
      totalIssues: totals.total,
      totalRepos: repoCount.cnt,
      successRate: totals.total > 0 ? (totals.succeeded / totals.total) : 0,
      byRepo: repos,
    }
  }

  recentResults(limit: number = 20): StatsRecord[] {
    const db = this.ensureOpen()
    const rows = db.prepare(`
      SELECT * FROM results ORDER BY processed_at DESC, id DESC LIMIT ?
    `).all(limit) as RawRow[]
    return rows.map(rowToRecord)
  }

  byModel(): Array<{ model: string; count: number; successRate: number }> {
    const db = this.ensureOpen()
    const rows = db.prepare(`
      SELECT model_used AS model,
             COUNT(*) AS count,
             CAST(SUM(success) AS REAL) / COUNT(*) AS successRate
      FROM results
      WHERE model_used IS NOT NULL
      GROUP BY model_used
      ORDER BY model_used
    `).all() as Array<{ model: string; count: number; successRate: number }>
    return rows
  }

  close(): void {
    if (this.db !== null) {
      this.db.close()
      this.db = null
    }
  }

  private ensureOpen(): Database.Database {
    if (this.db === null) {
      throw new Error('Database is closed')
    }
    return this.db
  }
}

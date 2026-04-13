import { describe, it, expect, afterEach } from 'vitest'
import { tmpdir } from 'node:os'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { StatsDatabase } from '../../../src/stats/database.js'
import type { ProcessingResult, StatsRecord } from '../../../src/types/index.js'

function makeResult(overrides: Partial<ProcessingResult> = {}): ProcessingResult {
  return {
    issueNumber: 1,
    repoFullName: 'owner/repo',
    success: true,
    isDraft: false,
    testsPassed: true,
    modelUsed: 'claude',
    filesChanged: ['src/index.ts'],
    ...overrides,
  }
}

function makeTempDbPath(): string {
  const dir = join(tmpdir(), `gh-pipeline-stats-test-${randomUUID()}`)
  mkdirSync(dir, { recursive: true })
  return join(dir, 'stats.db')
}

describe('StatsDatabase', () => {
  const dbs: StatsDatabase[] = []

  function createDb(path: string = ':memory:'): StatsDatabase {
    const db = new StatsDatabase(path)
    dbs.push(db)
    return db
  }

  afterEach(() => {
    for (const db of dbs) {
      db.close()
    }
    dbs.length = 0
  })

  describe('schema creation', () => {
    it('creates the results table on construction', () => {
      const db = createDb()
      // If the table exists, summary() should work without throwing
      const summary = db.summary()
      expect(summary.totalIssues).toBe(0)
      expect(summary.totalRepos).toBe(0)
      expect(summary.successRate).toBe(0)
      expect(summary.byRepo).toEqual([])
    })
  })

  describe('recordResult', () => {
    it('inserts a ProcessingResult and reads it back', () => {
      const db = createDb()
      db.recordResult(makeResult({
        issueNumber: 42,
        repoFullName: 'acme/api',
        success: true,
        isDraft: false,
        testsPassed: true,
        modelUsed: 'claude',
        filesChanged: ['a.ts', 'b.ts'],
        prUrl: 'https://github.com/acme/api/pull/101',
      }))

      const records = db.recentResults()
      expect(records).toHaveLength(1)

      const r = (records[0] as StatsRecord)
      expect(r.repo).toBe('acme/api')
      expect(r.issueNumber).toBe(42)
      expect(r.success).toBe(true)
      expect(r.isDraft).toBe(false)
      expect(r.testsPassed).toBe(true)
      expect(r.modelUsed).toBe('claude')
      expect(r.filesChanged).toBe(2)
      expect(r.prUrl).toBe('https://github.com/acme/api/pull/101')
      expect(r.error).toBeNull()
      expect(r.processedAt).toBeTruthy()
    })

    it('stores error field when present', () => {
      const db = createDb()
      db.recordResult(makeResult({
        success: false,
        error: 'AI timeout',
      }))

      const records = db.recentResults()
      expect((records[0] as StatsRecord).error).toBe('AI timeout')
      expect((records[0] as StatsRecord).success).toBe(false)
    })

    it('stores null prUrl when not provided', () => {
      const db = createDb()
      db.recordResult(makeResult())

      const records = db.recentResults()
      expect((records[0] as StatsRecord).prUrl).toBeNull()
    })
  })

  describe('upsert', () => {
    it('replaces existing row on same repo + issue_number', () => {
      const db = createDb()
      db.recordResult(makeResult({
        issueNumber: 10,
        repoFullName: 'acme/api',
        success: false,
        error: 'first try failed',
      }))
      db.recordResult(makeResult({
        issueNumber: 10,
        repoFullName: 'acme/api',
        success: true,
        prUrl: 'https://github.com/acme/api/pull/200',
      }))

      const records = db.recentResults()
      expect(records).toHaveLength(1)
      expect((records[0] as StatsRecord).success).toBe(true)
      expect((records[0] as StatsRecord).prUrl).toBe('https://github.com/acme/api/pull/200')
    })
  })

  describe('summary', () => {
    it('returns correct counts and success rate across repos', () => {
      const db = createDb()
      db.recordResult(makeResult({ issueNumber: 1, repoFullName: 'a/x', success: true }))
      db.recordResult(makeResult({ issueNumber: 2, repoFullName: 'a/x', success: false }))
      db.recordResult(makeResult({ issueNumber: 3, repoFullName: 'b/y', success: true }))
      db.recordResult(makeResult({ issueNumber: 4, repoFullName: 'b/y', success: true }))
      db.recordResult(makeResult({ issueNumber: 5, repoFullName: 'c/z', success: false }))

      const summary = db.summary()
      expect(summary.totalIssues).toBe(5)
      expect(summary.totalRepos).toBe(3)
      expect(summary.successRate).toBeCloseTo(0.6, 5)

      expect(summary.byRepo).toHaveLength(3)

      const ax = summary.byRepo.find((r) => r.repo === 'a/x')
      expect(ax).toEqual({ repo: 'a/x', total: 2, succeeded: 1, failed: 1 })

      const by = summary.byRepo.find((r) => r.repo === 'b/y')
      expect(by).toEqual({ repo: 'b/y', total: 2, succeeded: 2, failed: 0 })

      const cz = summary.byRepo.find((r) => r.repo === 'c/z')
      expect(cz).toEqual({ repo: 'c/z', total: 1, succeeded: 0, failed: 1 })
    })

    it('returns zero successRate when no results exist', () => {
      const db = createDb()
      expect(db.summary().successRate).toBe(0)
    })
  })

  describe('byModel', () => {
    it('groups results by model with correct counts and rates', () => {
      const db = createDb()
      db.recordResult(makeResult({ issueNumber: 1, repoFullName: 'a/x', modelUsed: 'claude', success: true }))
      db.recordResult(makeResult({ issueNumber: 2, repoFullName: 'a/x', modelUsed: 'claude', success: false }))
      db.recordResult(makeResult({ issueNumber: 3, repoFullName: 'a/x', modelUsed: 'codex', success: true }))
      db.recordResult(makeResult({ issueNumber: 4, repoFullName: 'a/x', modelUsed: 'ollama', success: true }))
      db.recordResult(makeResult({ issueNumber: 5, repoFullName: 'a/x', modelUsed: 'ollama', success: false }))

      const models = db.byModel()
      expect(models).toHaveLength(3)

      const claude = models.find((m) => m.model === 'claude')
      expect(claude).toEqual({ model: 'claude', count: 2, successRate: 0.5 })

      const codex = models.find((m) => m.model === 'codex')
      expect(codex).toEqual({ model: 'codex', count: 1, successRate: 1 })

      const ollama = models.find((m) => m.model === 'ollama')
      expect(ollama).toEqual({ model: 'ollama', count: 2, successRate: 0.5 })
    })

    it('returns empty array when no results exist', () => {
      const db = createDb()
      expect(db.byModel()).toEqual([])
    })
  })

  describe('recentResults', () => {
    it('returns results ordered by most recent first', () => {
      const db = createDb()
      for (let i = 1; i <= 5; i++) {
        db.recordResult(makeResult({ issueNumber: i, repoFullName: `a/r${i}` }))
      }

      const results = db.recentResults()
      expect(results).toHaveLength(5)
      // Most recent should be last inserted (highest id)
      expect((results[0] as StatsRecord).id).toBeGreaterThan((results[4] as StatsRecord).id)
    })

    it('respects default limit of 20', () => {
      const db = createDb()
      for (let i = 1; i <= 30; i++) {
        db.recordResult(makeResult({ issueNumber: i, repoFullName: `a/r${i}` }))
      }

      const results = db.recentResults()
      expect(results).toHaveLength(20)
    })

    it('respects custom limit', () => {
      const db = createDb()
      for (let i = 1; i <= 30; i++) {
        db.recordResult(makeResult({ issueNumber: i, repoFullName: `a/r${i}` }))
      }

      const results = db.recentResults(5)
      expect(results).toHaveLength(5)
    })
  })

  describe('close', () => {
    it('does not throw on double close', () => {
      const db = createDb()
      db.close()
      expect(() => db.close()).not.toThrow()
    })

    it('throws on operations after close', () => {
      const db = new StatsDatabase(':memory:')
      db.close()
      expect(() => db.summary()).toThrow('Database is closed')
    })
  })

  describe('filesystem persistence', () => {
    it('persists data across re-opens', () => {
      const dbPath = makeTempDbPath()
      const db1 = new StatsDatabase(dbPath)
      db1.recordResult(makeResult({ issueNumber: 7, repoFullName: 'x/y' }))
      db1.close()

      const db2 = createDb(dbPath)
      const results = db2.recentResults()
      expect(results).toHaveLength(1)
      expect((results[0] as StatsRecord).issueNumber).toBe(7)
    })
  })
})

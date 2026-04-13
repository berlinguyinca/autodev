/**
 * SpecCache — file-based cache for MAP pipeline results.
 *
 * Caches AI results keyed by repo + issue number so that re-runs
 * (e.g., after state reset or partial failure) can skip expensive
 * MAP invocations if a cached result exists and is still fresh.
 *
 * Cache entries are stored as JSON files in `.pipeline-cache/`.
 */

import { mkdirSync, readFileSync, writeFileSync, existsSync, readdirSync, unlinkSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { createHash } from 'node:crypto'
import type { AgentResult } from '../types/index.js'

const DEFAULT_CACHE_DIR = '.pipeline-cache'
const DEFAULT_TTL_MS = 7 * 24 * 60 * 60 * 1000 // 7 days

interface CacheEntry {
  key: string
  result: AgentResult
  model: string
  createdAt: string // ISO 8601
  issueTitle: string
  issueNumber: number
  repoFullName: string
}

export class SpecCache {
  private readonly cacheDir: string
  private readonly ttlMs: number

  constructor(cacheDir?: string, ttlMs?: number) {
    this.cacheDir = cacheDir ?? DEFAULT_CACHE_DIR
    this.ttlMs = ttlMs ?? DEFAULT_TTL_MS
  }

  /**
   * Look up a cached result for the given repo + issue.
   * Returns undefined if no cache entry exists or it has expired.
   */
  get(repoFullName: string, issueNumber: number): { result: AgentResult; model: string } | undefined {
    const filePath = this.entryPath(repoFullName, issueNumber)
    if (!existsSync(filePath)) return undefined

    try {
      const raw = readFileSync(filePath, 'utf-8')
      const entry = JSON.parse(raw) as CacheEntry

      // Check TTL
      const age = Date.now() - new Date(entry.createdAt).getTime()
      if (age > this.ttlMs) {
        this.evict(repoFullName, issueNumber)
        return undefined
      }

      return { result: entry.result, model: entry.model }
    } catch {
      return undefined
    }
  }

  /**
   * Store a result in the cache.
   */
  set(
    repoFullName: string,
    issueNumber: number,
    issueTitle: string,
    result: AgentResult,
    model: string,
  ): void {
    mkdirSync(this.cacheDir, { recursive: true })

    const key = this.cacheKey(repoFullName, issueNumber)
    const entry: CacheEntry = {
      key,
      result,
      model,
      createdAt: new Date().toISOString(),
      issueTitle,
      issueNumber,
      repoFullName,
    }

    writeFileSync(this.entryPath(repoFullName, issueNumber), JSON.stringify(entry, null, 2), 'utf-8')
  }

  /**
   * Remove a specific cache entry.
   */
  evict(repoFullName: string, issueNumber: number): void {
    const filePath = this.entryPath(repoFullName, issueNumber)
    if (existsSync(filePath)) {
      unlinkSync(filePath)
    }
  }

  /**
   * Remove all expired entries from the cache directory.
   */
  prune(): number {
    if (!existsSync(this.cacheDir)) return 0
    let pruned = 0

    for (const file of readdirSync(this.cacheDir)) {
      if (!file.endsWith('.json')) continue
      const filePath = join(this.cacheDir, file)
      try {
        const stat = statSync(filePath)
        if (Date.now() - stat.mtimeMs > this.ttlMs) {
          unlinkSync(filePath)
          pruned++
        }
      } catch {
        // Ignore errors during pruning
      }
    }

    return pruned
  }

  private cacheKey(repoFullName: string, issueNumber: number): string {
    return createHash('sha256').update(`${repoFullName}#${issueNumber}`).digest('hex').slice(0, 16)
  }

  private entryPath(repoFullName: string, issueNumber: number): string {
    const key = this.cacheKey(repoFullName, issueNumber)
    return join(this.cacheDir, `${key}.json`)
  }
}

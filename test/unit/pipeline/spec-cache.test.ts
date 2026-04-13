import { describe, it, expect, beforeEach } from 'vitest'
import { tmpdir } from 'node:os'
import { mkdirSync, readFileSync, readdirSync, writeFileSync, symlinkSync } from 'node:fs'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { SpecCache } from '../../../src/pipeline/spec-cache.js'

function makeTempCacheDir(): string {
  const dir = join(tmpdir(), `spec-cache-test-${randomUUID()}`)
  mkdirSync(dir, { recursive: true })
  return dir
}

const mockResult = {
  success: true as const,
  filesWritten: ['src/index.ts', 'test/index.test.ts'],
  stdout: 'Generated spec content',
  stderr: '',
}

describe('SpecCache', () => {
  let cacheDir: string
  let cache: SpecCache

  beforeEach(() => {
    cacheDir = makeTempCacheDir()
    cache = new SpecCache(cacheDir)
  })

  describe('get/set', () => {
    it('returns undefined for uncached entries', () => {
      expect(cache.get('owner/repo', 42)).toBeUndefined()
    })

    it('stores and retrieves cached results', () => {
      cache.set('owner/repo', 42, 'Fix the bug', mockResult, 'map')

      const cached = cache.get('owner/repo', 42)
      expect(cached).toBeDefined()
      expect(cached?.model).toBe('map')
      expect(cached?.result.success).toBe(true)
      expect(cached?.result.filesWritten).toEqual(['src/index.ts', 'test/index.test.ts'])
    })

    it('caches are keyed by repo + issue number', () => {
      cache.set('owner/repo-a', 1, 'Title A', mockResult, 'claude')
      cache.set('owner/repo-b', 1, 'Title B', mockResult, 'map')

      expect(cache.get('owner/repo-a', 1)?.model).toBe('claude')
      expect(cache.get('owner/repo-b', 1)?.model).toBe('map')
    })

    it('different issues in same repo are cached separately', () => {
      cache.set('owner/repo', 1, 'Issue 1', mockResult, 'claude')
      cache.set('owner/repo', 2, 'Issue 2', mockResult, 'map')

      expect(cache.get('owner/repo', 1)?.model).toBe('claude')
      expect(cache.get('owner/repo', 2)?.model).toBe('map')
      expect(cache.get('owner/repo', 3)).toBeUndefined()
    })
  })

  describe('error handling', () => {
    it('returns undefined when cache file contains invalid JSON', () => {
      // Manually write a corrupt JSON file where the cache key would be
      cache.set('owner/repo', 99, 'Title', mockResult, 'map')
      // Find and corrupt the file
      const files = readdirSync(cacheDir).filter((f) => f.endsWith('.json'))
      const fileName = files[0]
      if (fileName) {
        writeFileSync(join(cacheDir, fileName), 'not valid json {{{')
      }

      // get() should catch the JSON parse error and return undefined
      expect(cache.get('owner/repo', 99)).toBeUndefined()
    })
  })

  describe('TTL expiration', () => {
    it('returns undefined for expired entries', () => {
      // Use a 1ms TTL
      const shortCache = new SpecCache(cacheDir, 1)
      shortCache.set('owner/repo', 1, 'Title', mockResult, 'map')

      // Entry should be expired after a small delay
      const start = Date.now()
      while (Date.now() - start < 5) { /* busy wait 5ms */ }

      expect(shortCache.get('owner/repo', 1)).toBeUndefined()
    })
  })

  describe('evict', () => {
    it('removes a specific cache entry', () => {
      cache.set('owner/repo', 1, 'Title', mockResult, 'map')
      expect(cache.get('owner/repo', 1)).toBeDefined()

      cache.evict('owner/repo', 1)
      expect(cache.get('owner/repo', 1)).toBeUndefined()
    })

    it('does not throw when evicting non-existent entry', () => {
      expect(() => cache.evict('owner/repo', 999)).not.toThrow()
    })
  })

  describe('prune', () => {
    it('removes expired entries', () => {
      const shortCache = new SpecCache(cacheDir, 1)
      shortCache.set('owner/repo', 1, 'Title 1', mockResult, 'map')
      shortCache.set('owner/repo', 2, 'Title 2', mockResult, 'claude')

      // Wait for expiration
      const start = Date.now()
      while (Date.now() - start < 5) { /* busy wait 5ms */ }

      const pruned = shortCache.prune()
      expect(pruned).toBe(2)
    })

    it('returns 0 when cache dir does not exist', () => {
      const noCache = new SpecCache(join(tmpdir(), `nonexistent-${randomUUID()}`))
      expect(noCache.prune()).toBe(0)
    })

    it('skips non-json files in cache dir during prune', () => {
      // Write a non-json file — prune should skip it (pruned = 0)
      writeFileSync(join(cacheDir, 'notajson.txt'), 'data')
      // Use a short TTL so any json files would be pruned
      const shortCache = new SpecCache(cacheDir, 1)
      const pruned = shortCache.prune()
      expect(pruned).toBe(0)
    })

    it('handles statSync failure gracefully during prune (inner catch)', () => {
      // Create a broken symlink with a .json extension: readdirSync sees it,
      // but statSync on it throws ENOENT because the target does not exist.
      // The inner catch must swallow the error.
      const brokenLink = join(cacheDir, 'broken-link.json')
      symlinkSync('/nonexistent-target-that-does-not-exist', brokenLink)

      const shortCache = new SpecCache(cacheDir, 1)
      // Should not throw, and pruned count should be 0 (statSync failed, file was not deleted)
      expect(() => shortCache.prune()).not.toThrow()
      const pruned = shortCache.prune()
      expect(pruned).toBe(0)
    })
  })

  describe('persistence', () => {
    it('cache entries survive new SpecCache instances', () => {
      cache.set('owner/repo', 1, 'Title', mockResult, 'map')

      const cache2 = new SpecCache(cacheDir)
      const cached = cache2.get('owner/repo', 1)
      expect(cached).toBeDefined()
      expect(cached?.model).toBe('map')
    })

    it('stores valid JSON files on disk', () => {
      cache.set('owner/repo', 42, 'Test issue', mockResult, 'map')

      const files = readdirSync(cacheDir)
      const jsonFiles = files.filter((f) => f.endsWith('.json'))
      expect(jsonFiles).toHaveLength(1)

      const fileName = jsonFiles[0]
      expect(fileName).toBeDefined()
      if (fileName) {
        const raw = readFileSync(join(cacheDir, fileName), 'utf-8')
        const entry = JSON.parse(raw)
        expect(entry.issueNumber).toBe(42)
        expect(entry.repoFullName).toBe('owner/repo')
        expect(entry.issueTitle).toBe('Test issue')
        expect(entry.model).toBe('map')
      }
    })
  })
})

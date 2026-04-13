import { describe, it, expect, vi, afterEach } from 'vitest'
import { mkdtempSync, writeFileSync, mkdirSync, utimesSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

import { scanModifiedFiles } from '../../../src/ai/file-scanner.js'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTmpDir(): string {
  return mkdtempSync(join(tmpdir(), 'file-scanner-test-'))
}

/** Set mtime on a file to the given epoch-ms value */
function setMtime(filePath: string, mtimeMs: number): void {
  const seconds = mtimeMs / 1000
  utimesSync(filePath, seconds, seconds)
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('scanModifiedFiles', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns files modified at or after beforeMs', () => {
    const dir = makeTmpDir()
    const filePath = join(dir, 'new-file.txt')
    writeFileSync(filePath, 'hello')

    const beforeMs = Date.now() - 1000
    setMtime(filePath, beforeMs + 500) // mtime after beforeMs

    const results = scanModifiedFiles(dir, beforeMs)
    expect(results).toContain(filePath)
  })

  it('excludes files modified before beforeMs', () => {
    const dir = makeTmpDir()
    const filePath = join(dir, 'old-file.txt')
    writeFileSync(filePath, 'old')

    const beforeMs = Date.now()
    setMtime(filePath, beforeMs - 5000) // mtime well before beforeMs

    const results = scanModifiedFiles(dir, beforeMs)
    expect(results).not.toContain(filePath)
  })

  it('returns empty array for non-existent directory (hits outer catch)', () => {
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const results = scanModifiedFiles('/non/existent/dir/abc123', 0)
    expect(results).toEqual([])
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('[file-scanner] Cannot scan directory'),
      expect.anything()
    )
  })

  it('skips non-file entries (directories)', () => {
    const dir = makeTmpDir()
    const subDir = join(dir, 'subdir')
    mkdirSync(subDir)

    // Only the directory exists, no files
    const results = scanModifiedFiles(dir, 0)
    // subdir itself should NOT be in results (only files are included)
    expect(results.filter(p => p === subDir)).toHaveLength(0)
  })

  it('returns empty array when directory is empty', () => {
    const dir = makeTmpDir()
    const results = scanModifiedFiles(dir, 0)
    expect(results).toEqual([])
  })

  it('includes files modified exactly at beforeMs (boundary condition)', () => {
    const dir = makeTmpDir()
    const filePath = join(dir, 'exact.txt')
    writeFileSync(filePath, 'exact')

    const beforeMs = Date.now() - 1000
    setMtime(filePath, beforeMs) // mtime exactly equals beforeMs

    const results = scanModifiedFiles(dir, beforeMs)
    expect(results).toContain(filePath)
  })

  it('returns multiple files when several are modified after beforeMs', () => {
    const dir = makeTmpDir()
    const fileA = join(dir, 'a.txt')
    const fileB = join(dir, 'b.txt')
    const fileC = join(dir, 'c.txt')
    writeFileSync(fileA, 'a')
    writeFileSync(fileB, 'b')
    writeFileSync(fileC, 'c')

    const beforeMs = Date.now() - 1000
    setMtime(fileA, beforeMs + 100)
    setMtime(fileB, beforeMs + 200)
    setMtime(fileC, beforeMs - 5000) // old file, excluded

    const results = scanModifiedFiles(dir, beforeMs)
    expect(results).toContain(fileA)
    expect(results).toContain(fileB)
    expect(results).not.toContain(fileC)
  })
})

// ---------------------------------------------------------------------------
// Inner catch branch — requires mocking statSync
// Use vi.doMock + dynamic import to get a fresh module instance with the mock
// ---------------------------------------------------------------------------

describe('scanModifiedFiles — inner catch (unreadable file)', () => {
  it('handles unreadable files gracefully and warns with Error message (hits lines 12-17)', async () => {
    // We need statSync to throw for a specific file. Since node:fs exports are
    // non-configurable in ESM, we use vi.doMock with a factory that wraps the real module.
    const realFs = await vi.importActual<typeof import('node:fs')>('node:fs')

    const dir = realFs.mkdtempSync(join(tmpdir(), 'file-scanner-inner-'))
    const goodFile = join(dir, 'good.txt')
    const badFile = join(dir, 'bad.txt')
    realFs.writeFileSync(goodFile, 'good')
    realFs.writeFileSync(badFile, 'bad')

    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined)

    // Mock node:fs so statSync throws an Error for badFile
    vi.doMock('node:fs', () => ({
      ...realFs,
      readdirSync: realFs.readdirSync,
      statSync: vi.fn((path: string, ...rest: unknown[]) => {
        if (String(path) === badFile) {
          throw new Error('EACCES: permission denied')
        }
        return (realFs.statSync as (...args: unknown[]) => unknown)(path, ...rest)
      }),
    }))

    // Re-import scanModifiedFiles with the new mock in effect
    const { scanModifiedFiles: scanMocked } = await import('../../../src/ai/file-scanner.js?v=inner-catch-error')

    const results = scanMocked(dir, 0)

    // goodFile should be in results, badFile should be skipped
    expect(results).toContain(goodFile)
    expect(results).not.toContain(badFile)
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('[file-scanner] Skipping unreadable file'),
      expect.stringContaining('EACCES')
    )

    vi.doUnmock('node:fs')
    consoleSpy.mockRestore()
  })

  it('handles non-Error throws from statSync (ternary else branch at line 17)', async () => {
    const realFs = await vi.importActual<typeof import('node:fs')>('node:fs')

    const dir = realFs.mkdtempSync(join(tmpdir(), 'file-scanner-non-error-'))
    const filePath = join(dir, 'file.txt')
    realFs.writeFileSync(filePath, 'data')

    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined)

    // Make statSync throw a non-Error value (a string)
    vi.doMock('node:fs', () => ({
      ...realFs,
      readdirSync: realFs.readdirSync,
      statSync: vi.fn((path: string) => {
        if (String(path) === filePath) {
            throw 'non-error-string'
        }
        return (realFs.statSync as (...args: unknown[]) => unknown)(path)
      }),
    }))

    const { scanModifiedFiles: scanMocked } = await import('../../../src/ai/file-scanner.js?v=inner-non-error')

    const results = scanMocked(dir, 0)

    expect(results).not.toContain(filePath)
    // The warn call's second arg is String(err) since err is not an Error
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('[file-scanner] Skipping unreadable file'),
      'non-error-string'
    )

    vi.doUnmock('node:fs')
    consoleSpy.mockRestore()
  })

})

// ---------------------------------------------------------------------------
// Line 9: entry without 'path' property — uses workingDir as fallback
// ---------------------------------------------------------------------------

describe('scanModifiedFiles — entry without path property (line 9 fallback)', () => {
  it('uses workingDir when Dirent entry has no path property', async () => {
    const realFs = await vi.importActual<typeof import('node:fs')>('node:fs')

    const dir = realFs.mkdtempSync(join(tmpdir(), 'file-scanner-nopath-'))
    const filePath = join(dir, 'file.txt')
    realFs.writeFileSync(filePath, 'data')

    // Create a fake Dirent-like entry without a 'path' property
    const fakeDirent = {
      name: 'file.txt',
      isFile: () => true,
      // deliberately no 'path' property
    }

    vi.doMock('node:fs', () => ({
      ...realFs,
      readdirSync: vi.fn(() => [fakeDirent]),
      statSync: realFs.statSync,
    }))

    const { scanModifiedFiles: scanMocked } = await import('../../../src/ai/file-scanner.js?v=no-path-entry')
    const results = scanMocked(dir, 0)

    // file.txt in dir should be found since workingDir is used as fallback
    expect(results).toContain(filePath)

    vi.doUnmock('node:fs')
  })
})

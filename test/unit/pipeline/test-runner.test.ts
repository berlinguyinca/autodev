import { describe, it, expect, vi } from 'vitest'
import { writeFileSync, mkdtempSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import type { RepoConfig } from '../../../src/types/index.js'

// ---------------------------------------------------------------------------
// Partial mock of node:child_process so we can override execSync for specific
// tests while keeping the real implementation for integration-style tests.
// ---------------------------------------------------------------------------

vi.mock('node:child_process', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:child_process')>()
  return {
    ...actual,
    execSync: vi.fn((...args: Parameters<typeof actual.execSync>) => actual.execSync(...args)),
  }
})

import { execSync } from 'node:child_process'
import { detectTestCommand, runTests } from '../../../src/pipeline/test-runner.js'

const execSyncMock = vi.mocked(execSync)

function makeTempDir(): string {
  return mkdtempSync(join(tmpdir(), 'test-runner-test-'))
}

const baseRepo: RepoConfig = { owner: 'acme', name: 'repo' }

describe('detectTestCommand', () => {
  it('uses repoConfig.testCommand when provided', () => {
    const dir = makeTempDir()
    const repo: RepoConfig = { ...baseRepo, testCommand: 'jest --ci' }
    expect(detectTestCommand(dir, repo)).toBe('jest --ci')
  })

  it('detects pnpm test when pnpm-lock.yaml present', () => {
    const dir = makeTempDir()
    writeFileSync(join(dir, 'pnpm-lock.yaml'), '')
    expect(detectTestCommand(dir, baseRepo)).toBe('pnpm test')
  })

  it('detects npm test when package-lock.json present', () => {
    const dir = makeTempDir()
    writeFileSync(join(dir, 'package-lock.json'), '{}')
    expect(detectTestCommand(dir, baseRepo)).toBe('npm test')
  })

  it('detects yarn test when yarn.lock present', () => {
    const dir = makeTempDir()
    writeFileSync(join(dir, 'yarn.lock'), '')
    expect(detectTestCommand(dir, baseRepo)).toBe('yarn test')
  })

  it('detects make test when Makefile with test: target present', () => {
    const dir = makeTempDir()
    writeFileSync(join(dir, 'Makefile'), 'test:\n\tgo test ./...\n')
    expect(detectTestCommand(dir, baseRepo)).toBe('make test')
  })

  it('does not detect make test when Makefile has no test: target', () => {
    const dir = makeTempDir()
    writeFileSync(join(dir, 'Makefile'), 'build:\n\tgo build ./...\n')
    expect(detectTestCommand(dir, baseRepo)).toBeNull()
  })

  it('detects go test ./... when go.mod present', () => {
    const dir = makeTempDir()
    writeFileSync(join(dir, 'go.mod'), 'module example.com/app\n\ngo 1.21\n')
    expect(detectTestCommand(dir, baseRepo)).toBe('go test ./...')
  })

  it('detects cargo test when Cargo.toml present', () => {
    const dir = makeTempDir()
    writeFileSync(join(dir, 'Cargo.toml'), '[package]\nname = "myapp"\n')
    expect(detectTestCommand(dir, baseRepo)).toBe('cargo test')
  })

  it('detects mvn test when pom.xml present', () => {
    const dir = makeTempDir()
    writeFileSync(join(dir, 'pom.xml'), '<project/>')
    expect(detectTestCommand(dir, baseRepo)).toBe('mvn test')
  })

  it('returns null when no known test files are found', () => {
    const dir = makeTempDir()
    expect(detectTestCommand(dir, baseRepo)).toBeNull()
  })
})

describe('runTests', () => {
  it('returns { passed: true } when command succeeds', () => {
    const dir = makeTempDir()
    const result = runTests(dir, 'echo ok')
    expect(result.passed).toBe(true)
    expect(result.output).toContain('ok')
  })

  it('returns { passed: false } when command fails', () => {
    const dir = makeTempDir()
    const result = runTests(dir, 'false')
    expect(result.passed).toBe(false)
  })

  it('output field is a string on success', () => {
    const dir = makeTempDir()
    const result = runTests(dir, 'echo hello')
    expect(typeof result.output).toBe('string')
  })

  it('output field is a string on failure', () => {
    const dir = makeTempDir()
    const result = runTests(dir, 'false')
    expect(typeof result.output).toBe('string')
  })

  it('captures stderr output when command fails with stderr output', () => {
    const dir = makeTempDir()
    // sh -c exits with code 1 and writes to stderr
    const result = runTests(dir, 'sh -c "echo test-error >&2; exit 1"')
    expect(result.passed).toBe(false)
    expect(result.output).toContain('test-error')
  })

  it('captures stdout output when command fails with stdout output', () => {
    const dir = makeTempDir()
    // Command writes to stdout then fails
    const result = runTests(dir, 'sh -c "echo stdout-output; exit 1"')
    expect(result.passed).toBe(false)
    expect(result.output).toContain('stdout-output')
  })

  it('handles error without stderr/stdout properties gracefully (defensive branches)', () => {
    const dir = makeTempDir()
    // Simulate an error that has no stderr or stdout Buffer properties
    // (covers the ?? '' fallback branches at lines 65-66)
    execSyncMock.mockImplementationOnce(() => {
      const err = new Error('command failed without output buffers')
      // Intentionally omit stderr/stdout so the defensive ternary falls to ''
      throw err
    })

    const result = runTests(dir, 'irrelevant')
    expect(result.passed).toBe(false)
    expect(typeof result.output).toBe('string')
  })
})

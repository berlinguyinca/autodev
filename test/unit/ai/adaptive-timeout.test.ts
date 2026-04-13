import { describe, it, expect, vi, beforeEach, type MockInstance } from 'vitest'
import { EventEmitter } from 'node:events'
import type { ChildProcess } from 'node:child_process'

// ---------------------------------------------------------------------------
// child_process mock
// ---------------------------------------------------------------------------

vi.mock('node:child_process', () => ({
  spawn: vi.fn(),
}))

import { spawn } from 'node:child_process'
import { invokeProcess, type InvokeProcessOptions } from '../../../src/ai/base-wrapper.js'
import { AITimeoutError, AIInvocationError } from '../../../src/ai/errors.js'

const spawnMock = spawn as unknown as MockInstance

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface FakeProcess {
  proc: ChildProcess & { stdout: EventEmitter; stderr: EventEmitter; kill: () => boolean }
  emitStdout: (data: string) => void
  emitStderr: (data: string) => void
  emitClose: (code: number) => void
  emitError: (err: Error) => void
}

function makeFakeProcess(): FakeProcess {
  const proc = new EventEmitter() as FakeProcess['proc']
  proc.stdout = new EventEmitter()
  proc.stderr = new EventEmitter()
  proc.kill = () => true

  return {
    proc,
    emitStdout: (data: string) => proc.stdout.emit('data', Buffer.from(data)),
    emitStderr: (data: string) => proc.stderr.emit('data', Buffer.from(data)),
    emitClose: (code: number) => proc.emit('close', code),
    emitError: (err: Error) => proc.emit('error', err),
  }
}

function baseOptions(overrides?: Partial<InvokeProcessOptions>): InvokeProcessOptions {
  return {
    command: 'test-cli',
    args: ['--run'],
    timeoutMs: 100,
    model: 'claude',
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('adaptive timeout in invokeProcess', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useRealTimers()
  })

  it('process with continuous output never times out', async () => {
    const fake = makeFakeProcess()
    spawnMock.mockReturnValue(fake.proc)

    const promise = invokeProcess(baseOptions({ timeoutMs: 150 }))

    // Emit output every 50ms to keep the process alive
    const interval = setInterval(() => {
      fake.emitStdout('data\n')
    }, 50)

    // Let it run past the 150ms timeout window, then close successfully
    await new Promise(r => setTimeout(r, 300))
    clearInterval(interval)
    fake.emitClose(0)

    const result = await promise
    expect(result.stdout).toContain('data')
  }, 5000)

  it('process that goes silent times out with AITimeoutError', async () => {
    vi.useFakeTimers()
    const fake = makeFakeProcess()
    spawnMock.mockReturnValue(fake.proc)

    const promise = invokeProcess(baseOptions({ timeoutMs: 100 }))

    // No output — advance time past the check interval + timeout
    vi.advanceTimersByTime(5_100)

    await expect(promise).rejects.toThrow(AITimeoutError)
    vi.useRealTimers()
  })

  it('process crash (non-zero exit) resolves immediately with AIInvocationError', async () => {
    const fake = makeFakeProcess()
    spawnMock.mockReturnValue(fake.proc)

    const promise = invokeProcess(baseOptions({ timeoutMs: 60_000 }))

    setImmediate(() => {
      fake.emitStderr('segfault')
      fake.emitClose(139)
    })

    await expect(promise).rejects.toThrow(AIInvocationError)
  })

  it('process that completes normally cleans up timer and returns result', async () => {
    const fake = makeFakeProcess()
    spawnMock.mockReturnValue(fake.proc)

    const promise = invokeProcess(baseOptions({ timeoutMs: 60_000 }))

    setImmediate(() => {
      fake.emitStdout('hello world')
      fake.emitClose(0)
    })

    const result = await promise
    expect(result.stdout).toBe('hello world')
    expect(result.stderr).toBe('')
  })

  it('onActivity callback fires on each stdout chunk', async () => {
    const fake = makeFakeProcess()
    spawnMock.mockReturnValue(fake.proc)

    const onActivity = vi.fn()
    const promise = invokeProcess(baseOptions({ timeoutMs: 60_000, onActivity }))

    setImmediate(() => {
      fake.emitStdout('chunk1')
      fake.emitStdout('chunk2')
      fake.emitClose(0)
    })

    await promise

    expect(onActivity).toHaveBeenCalledTimes(2)
    expect(onActivity).toHaveBeenCalledWith(6) // 'chunk1'.length
    expect(onActivity).toHaveBeenCalledWith(6) // 'chunk2'.length
  })

  it('onActivity callback fires on stderr chunks too', async () => {
    const fake = makeFakeProcess()
    spawnMock.mockReturnValue(fake.proc)

    const onActivity = vi.fn()
    const promise = invokeProcess(baseOptions({ timeoutMs: 60_000, onActivity }))

    setImmediate(() => {
      fake.emitStderr('warning')
      fake.emitClose(0)
    })

    // Non-zero exit on stderr but code 0 → success
    await promise

    expect(onActivity).toHaveBeenCalledWith(7) // 'warning'.length
  })

  it('custom timeoutExtensionMs value is respected', async () => {
    vi.useFakeTimers()
    const fake = makeFakeProcess()
    spawnMock.mockReturnValue(fake.proc)

    // timeoutMs = 60s (initial), but extensionMs = 100ms (very short)
    const promise = invokeProcess(baseOptions({
      timeoutMs: 60_000,
      timeoutExtensionMs: 100,
    }))

    // No output — should timeout based on extensionMs, not timeoutMs
    vi.advanceTimersByTime(5_100)

    await expect(promise).rejects.toThrow(AITimeoutError)
    vi.useRealTimers()
  })

  it('timeoutExtensionMs defaults to timeoutMs when not specified', async () => {
    vi.useFakeTimers()
    const fake = makeFakeProcess()
    spawnMock.mockReturnValue(fake.proc)

    const promise = invokeProcess(baseOptions({ timeoutMs: 100 }))

    // Advance past the interval check
    vi.advanceTimersByTime(5_100)

    await expect(promise).rejects.toThrow(AITimeoutError)
    vi.useRealTimers()
  })

  it('output resets the adaptive timeout window', async () => {
    const fake = makeFakeProcess()
    spawnMock.mockReturnValue(fake.proc)

    // Use a 200ms extension window with real timers
    const promise = invokeProcess(baseOptions({ timeoutMs: 200, timeoutExtensionMs: 200 }))

    // Emit output before timeout, repeatedly
    const emissions = [50, 100, 150, 200, 250]
    for (const delay of emissions) {
      setTimeout(() => fake.emitStdout(`tick-${delay}\n`), delay)
    }

    // Close after the last emission
    setTimeout(() => fake.emitClose(0), 300)

    const result = await promise
    expect(result.stdout).toContain('tick-250')
  }, 5000)
})

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { TaskTracker } from '../../../src/tui/task-tracker.js'
import type { TaskStartOptions } from '../../../src/tui/task-tracker.js'
import type { TaskState } from '../../../src/types/index.js'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeStartOpts(overrides?: Partial<TaskStartOptions>): TaskStartOptions {
  return {
    id: 'acme/api#42:specGeneration',
    repo: 'acme/api',
    issueNumber: 42,
    phase: 'specGeneration',
    provider: 'claude',
    ...overrides,
  }
}

/** Retrieve a task or fail the test if missing. */
function getTask(tracker: TaskTracker, id: string): TaskState {
  const task = tracker.getTasks().get(id)
  expect(task).toBeDefined()
  return task as TaskState
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('TaskTracker', () => {
  let tracker: TaskTracker

  beforeEach(() => {
    tracker = new TaskTracker()
  })

  // --- start ---

  it('start() adds a task with status running', () => {
    tracker.start(makeStartOpts())

    const tasks = tracker.getTasks()
    expect(tasks.size).toBe(1)
    const task = getTask(tracker, 'acme/api#42:specGeneration')
    expect(task.status).toBe('running')
    expect(task.repo).toBe('acme/api')
    expect(task.issueNumber).toBe(42)
    expect(task.phase).toBe('specGeneration')
    expect(task.provider).toBe('claude')
    expect(task.bytesReceived).toBe(0)
    expect(task.startedAt).toBeGreaterThan(0)
  })

  it('start() emits task:start event', () => {
    const listener = vi.fn()
    tracker.on('task:start', listener)

    tracker.start(makeStartOpts())

    expect(listener).toHaveBeenCalledOnce()
    const arg = listener.mock.calls[0] as [TaskState]
    expect(arg[0]).toMatchObject({ id: 'acme/api#42:specGeneration' })
  })

  it('start() stores pid when provided', () => {
    tracker.start(makeStartOpts({ pid: 12345 }))

    const task = getTask(tracker, 'acme/api#42:specGeneration')
    expect(task.pid).toBe(12345)
  })

  // --- activity ---

  it('activity() updates lastActivityAt and bytesReceived', () => {
    tracker.start(makeStartOpts())

    const before = getTask(tracker, 'acme/api#42:specGeneration').lastActivityAt
    tracker.activity('acme/api#42:specGeneration', 1024)

    const after = getTask(tracker, 'acme/api#42:specGeneration')
    expect(after.bytesReceived).toBe(1024)
    expect(after.lastActivityAt).toBeGreaterThanOrEqual(before)
  })

  it('activity() accumulates bytes from multiple calls', () => {
    tracker.start(makeStartOpts())

    tracker.activity('acme/api#42:specGeneration', 100)
    tracker.activity('acme/api#42:specGeneration', 200)
    tracker.activity('acme/api#42:specGeneration', 300)

    const task = getTask(tracker, 'acme/api#42:specGeneration')
    expect(task.bytesReceived).toBe(600)
  })

  it('activity() emits task:activity event', () => {
    tracker.start(makeStartOpts())
    const listener = vi.fn()
    tracker.on('task:activity', listener)

    tracker.activity('acme/api#42:specGeneration', 512)

    expect(listener).toHaveBeenCalledWith('acme/api#42:specGeneration', 512)
  })

  it('activity() is a no-op for unknown task ids', () => {
    // Should not throw
    tracker.activity('nonexistent', 100)
    expect(tracker.getTasks().size).toBe(0)
  })

  // --- complete ---

  it('complete() sets status to success', () => {
    tracker.start(makeStartOpts())
    tracker.complete('acme/api#42:specGeneration')

    const task = getTask(tracker, 'acme/api#42:specGeneration')
    expect(task.status).toBe('success')
  })

  it('complete() emits task:complete event', () => {
    tracker.start(makeStartOpts())
    const listener = vi.fn()
    tracker.on('task:complete', listener)

    tracker.complete('acme/api#42:specGeneration')

    expect(listener).toHaveBeenCalledWith('acme/api#42:specGeneration')
  })

  // --- fail ---

  it('fail() sets status to failed and stores error', () => {
    tracker.start(makeStartOpts())
    tracker.fail('acme/api#42:specGeneration', 'AI timed out')

    const task = getTask(tracker, 'acme/api#42:specGeneration')
    expect(task.status).toBe('failed')
    expect(task.error).toBe('AI timed out')
  })

  it('fail() emits task:fail event', () => {
    tracker.start(makeStartOpts())
    const listener = vi.fn()
    tracker.on('task:fail', listener)

    tracker.fail('acme/api#42:specGeneration', 'crash')

    expect(listener).toHaveBeenCalledWith('acme/api#42:specGeneration', 'crash')
  })

  it('fail() is a no-op for unknown task ids', () => {
    // Should not throw
    tracker.fail('nonexistent', 'error')
    expect(tracker.getTasks().size).toBe(0)
  })

  // --- kill ---

  it('kill() sends signal via registered handler and sets status to killed', () => {
    tracker.start(makeStartOpts())
    const handler = vi.fn()
    tracker.registerKillHandler('acme/api#42:specGeneration', handler)

    const result = tracker.kill('acme/api#42:specGeneration')

    expect(result).toBe(true)
    expect(handler).toHaveBeenCalledOnce()
    const task = getTask(tracker, 'acme/api#42:specGeneration')
    expect(task.status).toBe('killed')
  })

  it('kill() emits task:killed event', () => {
    tracker.start(makeStartOpts())
    tracker.registerKillHandler('acme/api#42:specGeneration', () => {})
    const listener = vi.fn()
    tracker.on('task:killed', listener)

    tracker.kill('acme/api#42:specGeneration')

    expect(listener).toHaveBeenCalledWith('acme/api#42:specGeneration')
  })

  it('kill() returns false for non-existent task', () => {
    const result = tracker.kill('nonexistent')
    expect(result).toBe(false)
  })

  it('kill() returns false for non-running task (already completed)', () => {
    tracker.start(makeStartOpts())
    tracker.complete('acme/api#42:specGeneration')

    const result = tracker.kill('acme/api#42:specGeneration')
    expect(result).toBe(false)
  })

  it('kill() works even without a registered handler', () => {
    tracker.start(makeStartOpts())

    const result = tracker.kill('acme/api#42:specGeneration')
    expect(result).toBe(true)

    const task = getTask(tracker, 'acme/api#42:specGeneration')
    expect(task.status).toBe('killed')
  })

  // --- getTasks ---

  it('getTasks() returns all tracked tasks', () => {
    tracker.start(makeStartOpts({ id: 'a', phase: 'specGeneration' }))
    tracker.start(makeStartOpts({ id: 'b', phase: 'implementation' }))
    tracker.start(makeStartOpts({ id: 'c', phase: 'review' }))

    const tasks = tracker.getTasks()
    expect(tasks.size).toBe(3)
  })

  it('getTasks() returns a map that reflects mutations to task state', () => {
    tracker.start(makeStartOpts())
    const tasks = tracker.getTasks()

    // Before mutation
    const before = tasks.get('acme/api#42:specGeneration')
    expect(before).toBeDefined()
    expect((before as TaskState).status).toBe('running')

    // After mutation
    tracker.complete('acme/api#42:specGeneration')
    const after = tasks.get('acme/api#42:specGeneration')
    expect((after as TaskState).status).toBe('success')
  })

  // --- kill handler cleanup ---

  it('complete() clears the kill handler', () => {
    tracker.start(makeStartOpts())
    const handler = vi.fn()
    tracker.registerKillHandler('acme/api#42:specGeneration', handler)

    tracker.complete('acme/api#42:specGeneration')

    // After completion, kill should return false
    const result = tracker.kill('acme/api#42:specGeneration')
    expect(result).toBe(false)
    expect(handler).not.toHaveBeenCalled()
  })

  it('fail() clears the kill handler', () => {
    tracker.start(makeStartOpts())
    const handler = vi.fn()
    tracker.registerKillHandler('acme/api#42:specGeneration', handler)

    tracker.fail('acme/api#42:specGeneration', 'error')

    const result = tracker.kill('acme/api#42:specGeneration')
    expect(result).toBe(false)
    expect(handler).not.toHaveBeenCalled()
  })
})

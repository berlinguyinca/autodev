import { EventEmitter } from 'node:events'
import type { TaskState, TaskStatus, PipelinePhase, AIModel } from '../types/index.js'

export interface TaskStartOptions {
  id: string
  repo: string
  issueNumber: number
  phase: PipelinePhase
  provider: AIModel
  pid?: number
}

export type TaskEvent =
  | { type: 'task:start'; task: TaskState }
  | { type: 'task:activity'; taskId: string; bytes: number }
  | { type: 'task:complete'; taskId: string }
  | { type: 'task:fail'; taskId: string; error: string }
  | { type: 'task:killed'; taskId: string }

export class TaskTracker extends EventEmitter {
  private readonly tasks = new Map<string, TaskState>()

  /** Map from task id to an abort function (kills the tracked process). */
  private readonly killHandlers = new Map<string, () => void>()

  start(opts: TaskStartOptions): void {
    const now = Date.now()
    const task: TaskState = {
      id: opts.id,
      repo: opts.repo,
      issueNumber: opts.issueNumber,
      phase: opts.phase,
      status: 'running',
      provider: opts.provider,
      startedAt: now,
      lastActivityAt: now,
      bytesReceived: 0,
    }
    if (opts.pid !== undefined) task.pid = opts.pid
    this.tasks.set(task.id, task)
    this.emit('task:start', task)
  }

  activity(taskId: string, bytes: number): void {
    const task = this.tasks.get(taskId)
    if (task === undefined) return
    task.lastActivityAt = Date.now()
    task.bytesReceived += bytes
    this.emit('task:activity', taskId, bytes)
  }

  complete(taskId: string): void {
    this.transition(taskId, 'success')
    this.killHandlers.delete(taskId)
    this.emit('task:complete', taskId)
  }

  fail(taskId: string, error: string): void {
    const task = this.tasks.get(taskId)
    if (task === undefined) return
    task.status = 'failed'
    task.error = error
    this.killHandlers.delete(taskId)
    this.emit('task:fail', taskId, error)
  }

  /** Register a kill handler for a running task. */
  registerKillHandler(taskId: string, handler: () => void): void {
    this.killHandlers.set(taskId, handler)
  }

  /** Send SIGTERM to the process associated with the given task. Returns false if not running. */
  kill(taskId: string): boolean {
    const task = this.tasks.get(taskId)
    if (task === undefined || task.status !== 'running') return false

    const handler = this.killHandlers.get(taskId)
    if (handler !== undefined) {
      handler()
      this.killHandlers.delete(taskId)
    }

    task.status = 'killed'
    this.emit('task:killed', taskId)
    return true
  }

  /** Returns a read-only snapshot of all tracked tasks. */
  getTasks(): ReadonlyMap<string, Readonly<TaskState>> {
    return this.tasks
  }

  private transition(taskId: string, status: TaskStatus): void {
    const task = this.tasks.get(taskId)
    if (task === undefined) return
    task.status = status
  }
}

import { spawn } from 'node:child_process'
import { AITimeoutError, AIBinaryNotFoundError, AIInvocationError } from './errors.js'

const ACTIVITY_CHECK_INTERVAL_MS = 5_000

export interface InvokeProcessOptions {
  command: string
  args: string[]
  cwd?: string
  timeoutMs: number
  /** How much silent time to allow before killing — defaults to timeoutMs. */
  timeoutExtensionMs?: number
  model: string
  /** Called whenever the subprocess writes to stdout or stderr. */
  onActivity?: (bytes: number) => void
}

export interface InvokeProcessResult {
  stdout: string
  stderr: string
}

export async function invokeProcess(options: InvokeProcessOptions): Promise<InvokeProcessResult> {
  const { command, args, cwd, timeoutMs, model, onActivity } = options
  const extensionMs = options.timeoutExtensionMs ?? timeoutMs

  return new Promise<InvokeProcessResult>((resolve, reject) => {
    let settled = false

    function settle(fn: () => void): void {
      if (!settled) {
        settled = true
        fn()
      }
    }

    let proc: ReturnType<typeof spawn>
    try {
      proc = spawn(command, args, {
        cwd,
        stdio: ['ignore', 'pipe', 'pipe'],
      })
    } catch (err) {
      const nodeErr = err as NodeJS.ErrnoException
      if (nodeErr.code === 'ENOENT') {
        reject(new AIBinaryNotFoundError(command))
      } else {
        reject(err)
      }
      return
    }

    let lastActivityTimestamp = Date.now()

    // Adaptive timeout: poll every 5s to check if the process has gone silent
    // beyond the allowed extension window.
    const interval = setInterval(() => {
      if (Date.now() - lastActivityTimestamp > extensionMs) {
        clearInterval(interval)
        try {
          proc.kill()
        } catch {
          // best effort
        }
        settle(() => reject(new AITimeoutError(model, extensionMs)))
      }
    }, ACTIVITY_CHECK_INTERVAL_MS)

    const stdoutChunks: Buffer[] = []
    const stderrChunks: Buffer[] = []

    proc.stdout?.on('data', (chunk: Buffer) => {
      stdoutChunks.push(chunk)
      lastActivityTimestamp = Date.now()
      onActivity?.(chunk.length)
    })
    proc.stderr?.on('data', (chunk: Buffer) => {
      stderrChunks.push(chunk)
      lastActivityTimestamp = Date.now()
      onActivity?.(chunk.length)
    })

    proc.on('error', (err: NodeJS.ErrnoException) => {
      clearInterval(interval)
      if (err.code === 'ENOENT') {
        settle(() => reject(new AIBinaryNotFoundError(command)))
      } else {
        settle(() => reject(err))
      }
    })

    proc.on('close', (code: number | null) => {
      clearInterval(interval)

      const stdout = Buffer.concat(stdoutChunks).toString('utf-8')
      const stderr = Buffer.concat(stderrChunks).toString('utf-8')

      if (code !== 0) {
        settle(() => reject(new AIInvocationError(model, code ?? -1, stderr || stdout)))
        return
      }

      settle(() => resolve({ stdout, stderr }))
    })
  })
}

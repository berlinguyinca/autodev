import React, { useState, useEffect, useCallback } from 'react'
import { render, Box, Text, useInput, useApp } from 'ink'
import type { TaskTracker } from './task-tracker.js'
import type { TaskState, TaskStatus } from '../types/index.js'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatElapsed(ms: number): string {
  const totalSec = Math.floor(ms / 1000)
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  return `${m}m ${String(s).padStart(2, '0')}s`
}

function statusIcon(status: TaskStatus): string {
  switch (status) {
    case 'running': return '●'
    case 'success': return '✓'
    case 'failed':  return '✗'
    case 'killed':  return '⊘'
    case 'timeout': return '⏱'
    case 'pending': return '○'
  }
}

function statusColor(status: TaskStatus): string {
  switch (status) {
    case 'running': return 'cyan'
    case 'success': return 'green'
    case 'failed':  return 'red'
    case 'killed':  return 'yellow'
    case 'timeout': return 'yellow'
    case 'pending': return 'gray'
  }
}

// ---------------------------------------------------------------------------
// Components
// ---------------------------------------------------------------------------

interface DashboardProps {
  tracker: TaskTracker
  onQuit: () => void
}

function Dashboard({ tracker, onQuit }: DashboardProps): React.ReactElement {
  const { exit } = useApp()
  const [tasks, setTasks] = useState<TaskState[]>([])
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [now, setNow] = useState(Date.now())

  const refresh = useCallback(() => {
    const snapshot = Array.from(tracker.getTasks().values())
    setTasks(snapshot)
  }, [tracker])

  useEffect(() => {
    refresh()
    const events = ['task:start', 'task:activity', 'task:complete', 'task:fail', 'task:killed'] as const
    for (const evt of events) {
      tracker.on(evt, refresh)
    }
    return () => {
      for (const evt of events) {
        tracker.removeListener(evt, refresh)
      }
    }
  }, [tracker, refresh])

  // Tick for elapsed time
  useEffect(() => {
    const timer = setInterval(() => { setNow(Date.now()) }, 1000)
    return () => { clearInterval(timer) }
  }, [])

  useInput((input, key) => {
    if (input === 'q') {
      onQuit()
      exit()
      return
    }
    if (input === 'k') {
      const task = tasks[selectedIndex]
      if (task !== undefined && task.status === 'running') {
        tracker.kill(task.id)
      }
      return
    }
    if (key.upArrow) {
      setSelectedIndex(prev => Math.max(0, prev - 1))
      return
    }
    if (key.downArrow) {
      setSelectedIndex(prev => Math.min(tasks.length - 1, prev + 1))
    }
  })

  const COL = { task: 30, provider: 10, elapsed: 10, status: 12 }

  return React.createElement(
    Box,
    { flexDirection: 'column' },
    React.createElement(Text, { bold: true }, 'gh-issue-pipeline  (Ctrl+C to stop)'),
    React.createElement(Box, { marginTop: 1, flexDirection: 'column' },
      React.createElement(
        Box,
        null,
        React.createElement(Text, { bold: true, dimColor: true }, pad('TASK', COL.task)),
        React.createElement(Text, { bold: true, dimColor: true }, pad('PROVIDER', COL.provider)),
        React.createElement(Text, { bold: true, dimColor: true }, pad('ELAPSED', COL.elapsed)),
        React.createElement(Text, { bold: true, dimColor: true }, pad('STATUS', COL.status)),
      ),
      ...tasks.map((t, i) => {
        const selected = i === selectedIndex
        const elapsed = t.status === 'running' || t.status === 'pending'
          ? formatElapsed(now - t.startedAt)
          : '—'
        const icon = statusIcon(t.status)
        const color = statusColor(t.status) as
          'cyan' | 'green' | 'red' | 'yellow' | 'gray'

        return React.createElement(
          Box,
          { key: t.id },
          React.createElement(Text, { inverse: selected }, pad(`${t.repo}#${t.issueNumber} ${t.phase}`, COL.task)),
          React.createElement(Text, { inverse: selected }, pad(t.provider, COL.provider)),
          React.createElement(Text, { inverse: selected }, pad(elapsed, COL.elapsed)),
          React.createElement(Text, { color, inverse: selected }, pad(`${icon} ${t.status}`, COL.status)),
        )
      }),
    ),
    React.createElement(Box, { marginTop: 1 },
      React.createElement(Text, { dimColor: true }, '  [k] Kill selected task   [↑/↓] Navigate   [q] Quit'),
    ),
  )
}

function pad(s: string, width: number): string {
  return s.length >= width ? s.slice(0, width) : s + ' '.repeat(width - s.length)
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface TUIHandle {
  unmount: () => void
}

export function startTUI(tracker: TaskTracker, onQuit: () => void): TUIHandle {
  const instance = render(
    React.createElement(Dashboard, { tracker, onQuit }),
  )
  return {
    unmount: () => { instance.unmount() },
  }
}

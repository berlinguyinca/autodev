import React, { useState, useLayoutEffect, useRef } from 'react'
import { Box, Text, useStdin } from 'ink'
import { colors, messages } from '../theme.js'

export interface Repo {
  owner: string
  name: string
}

export interface RepoSelectorProps {
  repos: Repo[]
  onSelect: (repo: Repo) => void
}

export function RepoSelector({ repos, onSelect }: RepoSelectorProps): React.JSX.Element {
  const [search, setSearch] = useState('')
  const [cursor, setCursor] = useState(0)

  const filtered = repos.filter((r) => {
    const full = `${r.owner}/${r.name}`.toLowerCase()
    return full.includes(search.toLowerCase())
  })

  // Clamp cursor when filtered list shrinks
  const safeCursor = filtered.length === 0 ? 0 : Math.min(cursor, filtered.length - 1)

  // Keep stable refs for the event handler
  const searchRef = useRef(search)
  const filteredRef = useRef(filtered)
  const safeCursorRef = useRef(safeCursor)
  const onSelectRef = useRef(onSelect)

  useLayoutEffect(() => { searchRef.current = search })
  useLayoutEffect(() => { filteredRef.current = filtered })
  useLayoutEffect(() => { safeCursorRef.current = safeCursor })
  useLayoutEffect(() => { onSelectRef.current = onSelect })

  const { internal_eventEmitter: eventEmitter, setRawMode, isRawModeSupported } = useStdin()

  useLayoutEffect(() => {
    if (isRawModeSupported) {
      setRawMode(true)
    }

    const handleInput = (chunk: string): void => {
      const isEnter = chunk === '\r' || chunk === '\n'
      const isBackspace = chunk === '\x7F' || chunk === '\b'
      const isDown = chunk === 'j' || chunk === '\x1B[B'
      const isUp = chunk === 'k' || chunk === '\x1B[A'

      if (isEnter) {
        const list = filteredRef.current
        const idx = safeCursorRef.current
        if (list.length > 0) {
          // idx is already clamped — safe to index
          const selected = list[idx]
          if (selected !== undefined) {
            onSelectRef.current(selected)
          }
        }
        return
      }

      if (isBackspace) {
        setSearch((s) => s.slice(0, -1))
        setCursor(0)
        return
      }

      if (isDown) {
        setCursor((c) => {
          const list = filteredRef.current
          return list.length === 0 ? 0 : Math.min(c + 1, list.length - 1)
        })
        return
      }

      if (isUp) {
        setCursor((c) => Math.max(0, c - 1))
        return
      }

      // Arrow escape sequences are multi-byte; skip lone ESC
      if (chunk === '\x1B') return

      // Printable characters — append to search
      if (chunk.length > 0) {
        setSearch((s) => s + chunk)
        setCursor(0)
      }
    }

    eventEmitter.on('input', handleInput)
    return () => {
      eventEmitter.removeListener('input', handleInput)
      if (isRawModeSupported) {
        setRawMode(false)
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventEmitter, setRawMode, isRawModeSupported])

  return (
    <Box flexDirection="column" borderStyle="round" borderColor={colors.banana} padding={1}>
      <Text color={colors.banana}>{messages.header('Bello! Select a repo')}</Text>
      <Box marginTop={1}>
        <Text color={colors.goggle}>Search: </Text>
        <Text>{search}</Text>
        <Text color={colors.banana}>█</Text>
      </Box>
      <Box flexDirection="column" marginTop={1}>
        {filtered.length === 0 ? (
          <Text color={colors.dim}>{messages.emptyTable()}</Text>
        ) : (
          filtered.map((repo, i) => {
            const isCurrent = i === safeCursor
            return (
              <Box key={`${repo.owner}/${repo.name}`}>
                {isCurrent ? (
                  <Text color={colors.banana}>{'▶ '}</Text>
                ) : (
                  <Text>{'  '}</Text>
                )}
                {isCurrent ? (
                  <Text color={colors.banana}>{`${repo.owner}/${repo.name}`}</Text>
                ) : (
                  <Text>{`${repo.owner}/${repo.name}`}</Text>
                )}
              </Box>
            )
          })
        )}
      </Box>
    </Box>
  )
}

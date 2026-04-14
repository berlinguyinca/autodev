import React from 'react'
import { Box, Text } from 'ink'
import { TextField } from './TextField.js'
import { useVim } from '../hooks/useVim.js'
import { colors, messages } from '../theme.js'

interface IssueFormProps {
  title: string
  body: string
  labels: string[]
  onTitleChange: (v: string) => void
  onBodyChange: (v: string) => void
  active: boolean
  editingIssue: number | undefined
}

export function IssueForm({
  title, body, labels, onTitleChange, onBodyChange, active, editingIssue,
}: IssueFormProps): React.JSX.Element {
  const { formField } = useVim()
  const borderColor = active ? colors.overalls : colors.dim

  const header = editingIssue !== undefined
    ? messages.header(`Editing #${editingIssue}`)
    : messages.header('Bello! Create Issue')

  return (
    <Box flexDirection="column" borderStyle="round" borderColor={borderColor} paddingX={1} flexGrow={1}>
      <Text color={colors.banana} bold>{header}</Text>
      <Box flexDirection="column" marginTop={1}>
        <TextField
          label="Title" value={title} onChange={onTitleChange}
          active={active && formField === 'title'}
        />
        <Box marginTop={1}>
          <TextField
            label="Body" value={body} onChange={onBodyChange}
            active={active && formField === 'body'}
            multiline
          />
        </Box>
      </Box>
      {labels.length > 0 && (
        <Box marginTop={1} gap={1}>
          {labels.map((l) => (
            <Text key={l} color={colors.goggle}>[{l}]</Text>
          ))}
        </Box>
      )}
    </Box>
  )
}

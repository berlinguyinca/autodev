import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render } from 'ink-testing-library'
import { VimProvider } from '../../../../src/cli/components/VimProvider.js'
import { TextField } from '../../../../src/cli/components/TextField.js'

function wrap(node: React.ReactNode, vimProps?: { onAction?: () => void }) {
  return <VimProvider {...vimProps}>{node}</VimProvider>
}

describe('TextField', () => {
  it('renders label and value', () => {
    const { lastFrame } = render(wrap(
      <TextField label="Title" value="Hello" onChange={() => {}} active={false} />
    ))
    expect(lastFrame()).toContain('Title')
    expect(lastFrame()).toContain('Hello')
  })

  it('shows (empty) placeholder when inactive and empty', () => {
    const { lastFrame } = render(wrap(
      <TextField label="Title" value="" onChange={() => {}} active={false} />
    ))
    expect(lastFrame()).toContain('(empty)')
  })

  it('does not show (empty) placeholder when value is provided', () => {
    const { lastFrame } = render(wrap(
      <TextField label="Title" value="something" onChange={() => {}} active={false} />
    ))
    expect(lastFrame()).not.toContain('(empty)')
  })

  it('does not accept typing in normal mode', () => {
    const onChange = vi.fn()
    const { stdin } = render(wrap(
      <TextField label="Title" value="" onChange={onChange} active={true} />
    ))
    stdin.write('x')
    // In normal mode, 'x' should NOT trigger onChange
    // (it may trigger vim actions instead)
    expect(onChange).not.toHaveBeenCalled()
  })

  it('accepts typing in insert mode when active', () => {
    const onChange = vi.fn()
    const { stdin } = render(wrap(
      <TextField label="Title" value="hi" onChange={onChange} active={true} />
    ))
    // Enter insert mode
    stdin.write('i')
    // Now type a character
    stdin.write('x')
    expect(onChange).toHaveBeenCalledWith('hix')
  })

  it('handles backspace in insert mode when active', () => {
    const onChange = vi.fn()
    const { stdin } = render(wrap(
      <TextField label="Title" value="hello" onChange={onChange} active={true} />
    ))
    stdin.write('i')
    stdin.write('\x7F')
    expect(onChange).toHaveBeenCalledWith('hell')
  })

  it('ignores typing when active=false even in insert mode', () => {
    const onChange = vi.fn()
    const { stdin } = render(wrap(
      <TextField label="Title" value="" onChange={onChange} active={false} />
    ))
    stdin.write('i')
    stdin.write('x')
    expect(onChange).not.toHaveBeenCalled()
  })

  it('shows cursor indicator when active and in insert mode', () => {
    const { lastFrame, stdin } = render(wrap(
      <TextField label="Title" value="test" onChange={() => {}} active={true} />
    ))
    stdin.write('i')
    // Cursor block should appear
    expect(lastFrame()).toContain('█')
  })

  it('does not show cursor indicator in normal mode', () => {
    const { lastFrame } = render(wrap(
      <TextField label="Title" value="test" onChange={() => {}} active={true} />
    ))
    // Normal mode by default — no cursor block
    expect(lastFrame()).not.toContain('█')
  })

  it('appends newline on Enter in multiline mode', () => {
    const onChange = vi.fn()
    const { stdin } = render(wrap(
      <TextField label="Body" value="line1" onChange={onChange} active={true} multiline={true} />
    ))
    stdin.write('i')
    stdin.write('\r')
    expect(onChange).toHaveBeenCalledWith('line1\n')
  })

  it('ignores Enter in single-line mode', () => {
    const onChange = vi.fn()
    const { stdin } = render(wrap(
      <TextField label="Title" value="hi" onChange={onChange} active={true} />
    ))
    stdin.write('i')
    stdin.write('\r')
    expect(onChange).not.toHaveBeenCalled()
  })

  it('stops accepting input after Escape back to normal', () => {
    const onChange = vi.fn()
    const { stdin } = render(wrap(
      <TextField label="Title" value="hi" onChange={onChange} active={true} />
    ))
    stdin.write('i')
    stdin.write('\x1B') // back to normal
    onChange.mockClear()
    stdin.write('x')
    expect(onChange).not.toHaveBeenCalled()
  })
})

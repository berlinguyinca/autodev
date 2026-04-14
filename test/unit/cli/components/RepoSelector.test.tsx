import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render } from 'ink-testing-library'
import { RepoSelector } from '../../../../src/cli/components/RepoSelector.js'

const repos = [
  { owner: 'org', name: 'api' },
  { owner: 'org', name: 'web' },
  { owner: 'other', name: 'lib' },
]

describe('RepoSelector', () => {
  it('renders header and all repos', () => {
    const { lastFrame } = render(
      <RepoSelector repos={repos} onSelect={() => {}} />
    )
    expect(lastFrame()).toContain('Bello')
    expect(lastFrame()).toContain('org/api')
    expect(lastFrame()).toContain('org/web')
    expect(lastFrame()).toContain('other/lib')
  })

  it('shows cursor on first item', () => {
    const { lastFrame } = render(
      <RepoSelector repos={repos} onSelect={() => {}} />
    )
    expect(lastFrame()).toContain('\u25b6')
  })

  it('filters repos by search term', () => {
    const { lastFrame, stdin } = render(
      <RepoSelector repos={repos} onSelect={() => {}} />
    )
    stdin.write('web')
    expect(lastFrame()).toContain('org/web')
    expect(lastFrame()).not.toContain('other/lib')
  })

  it('calls onSelect with first item on Enter', () => {
    const onSelect = vi.fn()
    const { stdin } = render(
      <RepoSelector repos={repos} onSelect={onSelect} />
    )
    stdin.write('\r')
    expect(onSelect).toHaveBeenCalledWith({ owner: 'org', name: 'api' })
  })

  it('navigates with j/k and selects', () => {
    const onSelect = vi.fn()
    const { stdin } = render(
      <RepoSelector repos={repos} onSelect={onSelect} />
    )
    stdin.write('j') // move to org/web
    stdin.write('\r')
    expect(onSelect).toHaveBeenCalledWith({ owner: 'org', name: 'web' })
  })

  it('navigates with arrow keys', () => {
    const onSelect = vi.fn()
    const { stdin } = render(
      <RepoSelector repos={repos} onSelect={onSelect} />
    )
    stdin.write('\x1B[B') // down arrow
    stdin.write('\r')
    expect(onSelect).toHaveBeenCalledWith({ owner: 'org', name: 'web' })
  })

  it('shows empty message when no repos match', () => {
    const { lastFrame, stdin } = render(
      <RepoSelector repos={repos} onSelect={() => {}} />
    )
    stdin.write('zzzzz')
    expect(lastFrame()).toContain('No bananas')
  })

  it('handles backspace in search', () => {
    const { lastFrame, stdin } = render(
      <RepoSelector repos={repos} onSelect={() => {}} />
    )
    stdin.write('web')
    expect(lastFrame()).not.toContain('other/lib')
    stdin.write('\x7F') // backspace
    stdin.write('\x7F')
    stdin.write('\x7F')
    // Should show all repos again after clearing search
    expect(lastFrame()).toContain('other/lib')
  })
})

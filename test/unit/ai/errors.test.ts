import { describe, it, expect } from 'vitest'
import { AITimeoutError, AIBinaryNotFoundError, AIInvocationError } from '../../../src/ai/errors.js'

describe('AITimeoutError', () => {
  it('extends Error', () => {
    const err = new AITimeoutError('claude', 5000)
    expect(err).toBeInstanceOf(Error)
    expect(err).toBeInstanceOf(AITimeoutError)
  })

  it('has correct name property', () => {
    const err = new AITimeoutError('claude', 5000)
    expect(err.name).toBe('AITimeoutError')
  })

  it('stores model and timeoutMs as readonly properties', () => {
    const err = new AITimeoutError('gpt-4', 30000)
    expect(err.model).toBe('gpt-4')
    expect(err.timeoutMs).toBe(30000)
  })

  it('produces expected message format', () => {
    const err = new AITimeoutError('claude', 120000)
    expect(err.message).toBe('AI invocation timed out after 120000ms (model: claude)')
  })
})

describe('AIBinaryNotFoundError', () => {
  it('extends Error', () => {
    const err = new AIBinaryNotFoundError('claude')
    expect(err).toBeInstanceOf(Error)
    expect(err).toBeInstanceOf(AIBinaryNotFoundError)
  })

  it('has correct name property', () => {
    const err = new AIBinaryNotFoundError('codex')
    expect(err.name).toBe('AIBinaryNotFoundError')
  })

  it('stores binary as readonly property', () => {
    const err = new AIBinaryNotFoundError('ollama')
    expect(err.binary).toBe('ollama')
  })

  it('produces expected message format', () => {
    const err = new AIBinaryNotFoundError('claude')
    expect(err.message).toBe('claude CLI not found \u2014 is it installed and on PATH?')
  })
})

describe('AIInvocationError', () => {
  it('extends Error', () => {
    const err = new AIInvocationError('claude', 1, 'something went wrong')
    expect(err).toBeInstanceOf(Error)
    expect(err).toBeInstanceOf(AIInvocationError)
  })

  it('has correct name property', () => {
    const err = new AIInvocationError('codex', 2, 'fail')
    expect(err.name).toBe('AIInvocationError')
  })

  it('stores model and exitCode as readonly properties', () => {
    const err = new AIInvocationError('ollama', 42, 'crash')
    expect(err.model).toBe('ollama')
    expect(err.exitCode).toBe(42)
  })

  it('produces expected message format', () => {
    const err = new AIInvocationError('claude', 1, 'out of memory')
    expect(err.message).toBe('AI invocation failed (model: claude, exit: 1): out of memory')
  })
})

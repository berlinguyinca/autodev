import { describe, it, expect, vi } from 'vitest'

// Mock node:fs before importing the module under test so vi.mock hoisting applies.
// This isolates these two tests from the main config.test.ts which uses real files.
vi.mock('node:fs', () => {
  return {
    readFileSync: vi.fn(),
    mkdirSync: vi.fn(),
    existsSync: vi.fn(),
    writeFileSync: vi.fn(),
  }
})

import * as fs from 'node:fs'
import type { Mock } from 'vitest'
import { loadConfig } from '../../../src/config/index.js'

describe('loadConfig non-Error throw branches', () => {
  it('includes string representation when readFileSync throws a non-Error value (line 55 else branch)', () => {
    ;(fs.readFileSync as Mock).mockImplementationOnce(() => {
      throw 'string-error-value'
    })
    expect(() => loadConfig('/some/path/repos.json')).toThrow(/string-error-value/)
  })

  it('includes string representation when JSON.parse throws a non-Error value (line 63 else branch)', () => {
    // readFileSync returns valid content, but we monkey-patch JSON.parse to throw a non-Error
    ;(fs.readFileSync as Mock).mockReturnValueOnce('{}')
    const origParse = JSON.parse
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(JSON as any).parse = () => {
      throw 99
    }
    try {
      expect(() => loadConfig('/some/path/repos.json')).toThrow(/99/)
    } finally {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(JSON as any).parse = origParse
    }
  })
})

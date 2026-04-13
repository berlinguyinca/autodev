import { describe, it, expect, vi } from 'vitest'
import type { PipelineConfig, RepoConfig } from '../../../src/types/index.js'

vi.mock('../../../src/config/config.js', () => ({
  saveConfig: vi.fn(),
}))

import {
  formatRepoList,
  addRepo,
  editRepo,
  removeRepo,
  persistConfig,
} from '../../../src/tui/repositories-tab.js'
import { saveConfig } from '../../../src/config/config.js'

function makeConfig(repos: RepoConfig[] = []): PipelineConfig {
  return {
    repos,
    ollamaModel: 'qwen2.5-coder:latest',
    maxIssuesPerRun: 10,
  }
}

describe('repositories-tab', () => {
  describe('formatRepoList', () => {
    it('formats repos as display strings', () => {
      const config = makeConfig([
        { owner: 'acme', name: 'api' },
        { owner: 'acme', name: 'web' },
      ])

      const items = formatRepoList(config)
      expect(items).toHaveLength(2)
      expect(items[0]).toEqual({ display: 'acme/api', owner: 'acme', name: 'api' })
      expect(items[1]).toEqual({ display: 'acme/web', owner: 'acme', name: 'web' })
    })

    it('returns empty array for no repos', () => {
      expect(formatRepoList(makeConfig())).toEqual([])
    })
  })

  describe('addRepo', () => {
    it('appends a new repo to config', () => {
      const config = makeConfig([{ owner: 'acme', name: 'api' }])
      const updated = addRepo(config, { owner: 'acme', name: 'web' })

      expect(updated.repos).toHaveLength(2)
      expect(updated.repos[1]).toEqual({ owner: 'acme', name: 'web' })
    })

    it('does not mutate original config', () => {
      const config = makeConfig([{ owner: 'acme', name: 'api' }])
      addRepo(config, { owner: 'acme', name: 'web' })

      expect(config.repos).toHaveLength(1)
    })

    it('preserves optional fields on the new repo', () => {
      const config = makeConfig([])
      const updated = addRepo(config, {
        owner: 'acme',
        name: 'api',
        defaultBranch: 'develop',
        testCommand: 'npm test',
      })

      expect((updated.repos[0] as RepoConfig).defaultBranch).toBe('develop')
      expect((updated.repos[0] as RepoConfig).testCommand).toBe('npm test')
    })
  })

  describe('editRepo', () => {
    it('replaces the repo at the given index', () => {
      const config = makeConfig([
        { owner: 'acme', name: 'api' },
        { owner: 'acme', name: 'web' },
      ])
      const updated = editRepo(config, 1, { owner: 'acme', name: 'mobile' })

      expect(updated.repos[1]).toEqual({ owner: 'acme', name: 'mobile' })
      expect(updated.repos[0]).toEqual({ owner: 'acme', name: 'api' })
    })

    it('does not mutate original config', () => {
      const config = makeConfig([{ owner: 'acme', name: 'api' }])
      editRepo(config, 0, { owner: 'acme', name: 'web' })

      expect((config.repos[0] as RepoConfig).name).toBe('api')
    })

    it('returns original config for out-of-bounds index', () => {
      const config = makeConfig([{ owner: 'acme', name: 'api' }])
      expect(editRepo(config, -1, { owner: 'x', name: 'y' })).toBe(config)
      expect(editRepo(config, 5, { owner: 'x', name: 'y' })).toBe(config)
    })
  })

  describe('removeRepo', () => {
    it('removes the repo at the given index', () => {
      const config = makeConfig([
        { owner: 'acme', name: 'api' },
        { owner: 'acme', name: 'web' },
        { owner: 'acme', name: 'mobile' },
      ])
      const updated = removeRepo(config, 1)

      expect(updated.repos).toHaveLength(2)
      expect((updated.repos[0] as RepoConfig).name).toBe('api')
      expect((updated.repos[1] as RepoConfig).name).toBe('mobile')
    })

    it('does not mutate original config', () => {
      const config = makeConfig([
        { owner: 'acme', name: 'api' },
        { owner: 'acme', name: 'web' },
      ])
      removeRepo(config, 0)

      expect(config.repos).toHaveLength(2)
    })

    it('returns original config for out-of-bounds index', () => {
      const config = makeConfig([{ owner: 'acme', name: 'api' }])
      expect(removeRepo(config, -1)).toBe(config)
      expect(removeRepo(config, 5)).toBe(config)
    })
  })

  describe('persistConfig', () => {
    it('calls saveConfig with the given path and config', () => {
      const config = makeConfig([{ owner: 'acme', name: 'api' }])
      persistConfig('/tmp/config.json', config)

      expect(saveConfig).toHaveBeenCalledWith('/tmp/config.json', config)
    })
  })
})

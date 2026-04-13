import type { PipelineConfig, RepoConfig } from '../types/index.js'
import { saveConfig } from '../config/config.js'

export interface RepoListItem {
  display: string
  owner: string
  name: string
}

export function formatRepoList(config: PipelineConfig): RepoListItem[] {
  return config.repos.map((r) => ({
    display: `${r.owner}/${r.name}`,
    owner: r.owner,
    name: r.name,
  }))
}

export function addRepo(
  config: PipelineConfig,
  repo: RepoConfig,
): PipelineConfig {
  return {
    ...config,
    repos: [...config.repos, repo],
  }
}

export function editRepo(
  config: PipelineConfig,
  index: number,
  updated: RepoConfig,
): PipelineConfig {
  if (index < 0 || index >= config.repos.length) {
    return config
  }
  const repos = [...config.repos]
  repos[index] = updated
  return { ...config, repos }
}

export function removeRepo(
  config: PipelineConfig,
  index: number,
): PipelineConfig {
  if (index < 0 || index >= config.repos.length) {
    return config
  }
  const repos = config.repos.filter((_, i) => i !== index)
  return { ...config, repos }
}

export function persistConfig(filePath: string, config: PipelineConfig): void {
  saveConfig(filePath, config)
}

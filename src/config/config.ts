import { z } from 'zod'
import { readFileSync } from 'node:fs'
import type { PipelineConfig, RepoConfig, ProviderConfig } from '../types/index.js'

const ProviderConfigSchema = z.object({
  timeoutMs: z.number().int().positive().optional(),
  timeoutExtensionMs: z.number().int().positive().optional(),
})

const RepoConfigSchema = z.object({
  owner: z.string().min(1),
  name: z.string().min(1),
  defaultBranch: z.string().default('main'),
  testCommand: z.string().optional(),
  cloneUrl: z.string().optional(),
})

const PipelineConfigSchema = z.object({
  repos: z.array(RepoConfigSchema),
  ollamaModel: z.string().default('qwen2.5-coder:latest'),
  maxIssuesPerRun: z.number().int().positive().default(10),
  quotaLimits: z
    .object({
      claude: z.number().int().positive().optional(),
      codex: z.number().int().positive().optional(),
    })
    .optional(),
  providers: z
    .object({
      claude: ProviderConfigSchema.optional(),
      codex: ProviderConfigSchema.optional(),
      ollama: ProviderConfigSchema.optional(),
    })
    .optional(),
})

type ZodParsed = z.infer<typeof PipelineConfigSchema>

function toProviderConfig(parsed: z.infer<typeof ProviderConfigSchema> | undefined): ProviderConfig | undefined {
  if (parsed === undefined) return undefined
  const cfg: ProviderConfig = {}
  if (parsed.timeoutMs !== undefined) cfg.timeoutMs = parsed.timeoutMs
  if (parsed.timeoutExtensionMs !== undefined) cfg.timeoutExtensionMs = parsed.timeoutExtensionMs
  return Object.keys(cfg).length > 0 ? cfg : undefined
}

/** Map zod output to our strict PipelineConfig type, dropping undefined optionals. */
function toTyped(parsed: ZodParsed): PipelineConfig {
  const config: PipelineConfig = {
    repos: parsed.repos.map((r): RepoConfig => {
      const repo: RepoConfig = { owner: r.owner, name: r.name, defaultBranch: r.defaultBranch }
      if (r.testCommand !== undefined) repo.testCommand = r.testCommand
      if (r.cloneUrl !== undefined) repo.cloneUrl = r.cloneUrl
      return repo
    }),
    ollamaModel: parsed.ollamaModel,
    maxIssuesPerRun: parsed.maxIssuesPerRun,
  }

  if (parsed.quotaLimits !== undefined) {
    const limits: NonNullable<PipelineConfig['quotaLimits']> = {}
    if (parsed.quotaLimits.claude !== undefined) limits.claude = parsed.quotaLimits.claude
    if (parsed.quotaLimits.codex !== undefined) limits.codex = parsed.quotaLimits.codex
    config.quotaLimits = limits
  }

  if (parsed.providers !== undefined) {
    const providers: NonNullable<PipelineConfig['providers']> = {}
    const claude = toProviderConfig(parsed.providers.claude)
    const codex = toProviderConfig(parsed.providers.codex)
    const ollama = toProviderConfig(parsed.providers.ollama)
    if (claude !== undefined) providers.claude = claude
    if (codex !== undefined) providers.codex = codex
    if (ollama !== undefined) providers.ollama = ollama
    if (Object.keys(providers).length > 0) config.providers = providers
  }

  return config
}

export function loadConfig(configPath: string): PipelineConfig {
  let raw: string
  try {
    raw = readFileSync(configPath, 'utf-8')
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    throw new Error(`Config file not found at "${configPath}": ${message}`)
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    throw new Error(`Invalid JSON in config file "${configPath}": ${message}`)
  }

  const result = PipelineConfigSchema.safeParse(parsed)
  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n')
    throw new Error(`Invalid config schema in "${configPath}":\n${issues}`)
  }

  return toTyped(result.data)
}

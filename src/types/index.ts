// Core domain types

export interface Issue {
  id: number;
  number: number;
  title: string;
  body: string;
  url: string;
  repoOwner: string;
  repoName: string;
}

export interface RepoConfig {
  owner: string;
  name: string;
  defaultBranch?: string;
  testCommand?: string;
  /** Override the git clone URL (useful for local/test environments). */
  cloneUrl?: string;
}

export interface PipelineConfig {
  repos: RepoConfig[];
  ollamaModel?: string;
  maxIssuesPerRun?: number;
  quotaLimits?: {
    claude?: number;
    codex?: number;
  };
  providers?: {
    claude?: ProviderConfig;
    codex?: ProviderConfig;
    ollama?: ProviderConfig;
  };
}

export interface QuotaState {
  used: number;
  limit: number;
  resetMonth: string; // "YYYY-MM" format, UTC
}

export interface PipelineState {
  processedIssues: Record<string, number[]>; // "owner/name" -> issue numbers[]
  quota: {
    claude: QuotaState;
    codex: QuotaState;
  };
}

export type AIModel = "claude" | "codex" | "ollama";

export interface AgentResult {
  success: boolean;
  filesWritten: string[];
  stdout: string;
  stderr: string;
}

export interface StructuredResult<T> {
  success: boolean;
  data?: T;
  rawOutput: string;
  error?: string;
}

export interface ReviewComment {
  path: string;
  line: number;
  body: string;
}

export interface SpecOutput {
  spec: string;
  filesToCreate: string[];
  testStrategy: string;
}

export interface ProcessingResult {
  issueNumber: number;
  repoFullName: string;
  success: boolean;
  prUrl?: string;
  isDraft: boolean;
  testsPassed: boolean;
  modelUsed: AIModel;
  filesChanged: string[];
  error?: string;
}

// Task monitoring types
export type TaskStatus = 'pending' | 'running' | 'success' | 'failed' | 'killed' | 'timeout';

export type PipelinePhase =
  | 'specGeneration'
  | 'implementation'
  | 'review'
  | 'followUp'
  | 'testRun'
  | 'push'
  | 'prCreation';

export interface TaskState {
  id: string;
  repo: string;
  issueNumber: number;
  phase: PipelinePhase;
  status: TaskStatus;
  provider: AIModel;
  startedAt: number;
  lastActivityAt: number;
  bytesReceived: number;
  pid?: number;
  error?: string;
}

// Provider config types
export interface ProviderConfig {
  timeoutMs?: number;
  timeoutExtensionMs?: number;
}

// Provider interfaces
export interface AIProvider {
  model: AIModel;
  invokeStructured<T>(prompt: string, schema: object): Promise<StructuredResult<T>>;
  invokeAgent(prompt: string, workingDir: string): Promise<AgentResult>;
}

import { readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

export function scanModifiedFiles(workingDir: string, beforeMs: number): string[] {
  const results: string[] = []
  try {
    for (const entry of readdirSync(workingDir, { recursive: true, withFileTypes: true })) {
      if (!entry.isFile()) continue
      /* v8 ignore next */
      const dir = 'path' in entry && typeof entry.path === 'string' ? entry.path : workingDir
      const fullPath = join(dir, entry.name)
      try {
        const st = statSync(fullPath)
        if (st.mtimeMs >= beforeMs) {
          results.push(fullPath)
        }
      } catch (err) {
        console.warn(`[file-scanner] Skipping unreadable file ${fullPath}:`, err instanceof Error ? err.message : String(err))
      }
    }
  } catch (err) {
    /* v8 ignore next */
    console.warn(`[file-scanner] Cannot scan directory ${workingDir}:`, err instanceof Error ? err.message : String(err))
  }
  return results
}

import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { emptySnapshot, type Snapshot } from './types.ts'

/**
 * Snapshot persistence.
 *
 * Deliberately a plain JSON file behind a narrow interface. The durable-database
 * decision is still open (ve#148 / DB-09 #138 — Neon Free versus Supabase Pro at
 * $25, over the $20 spend bar), and this feature does not need to force it. When
 * a store is chosen, only this module changes.
 *
 * `AI_SPEND_SNAPSHOT_PATH` overrides the location; on Vercel the only writable
 * directory is `/tmp`, so a deployed instance must point at object storage
 * instead — see readSnapshot's note.
 */

export const DEFAULT_SNAPSHOT_PATH = '.data/ai-spend-snapshot.json'

export function snapshotPath(): string {
  return resolve(process.env.AI_SPEND_SNAPSHOT_PATH ?? DEFAULT_SNAPSHOT_PATH)
}

export async function readSnapshot(path: string = snapshotPath()): Promise<Snapshot | null> {
  try {
    const raw = await readFile(path, 'utf8')
    const parsed = JSON.parse(raw) as Snapshot
    // A snapshot from a future/older format is not silently reinterpreted.
    if (parsed.version !== 1) return null
    return parsed
  } catch {
    return null
  }
}

export async function readSnapshotOrEmpty(
  machine: string,
  path: string = snapshotPath(),
): Promise<Snapshot> {
  return (await readSnapshot(path)) ?? emptySnapshot(machine)
}

/**
 * Write atomically: a dashboard reading the file while ingest rewrites it must
 * never see a half-written document.
 */
export async function writeSnapshot(
  snapshot: Snapshot,
  path: string = snapshotPath(),
): Promise<void> {
  await mkdir(dirname(path), { recursive: true })
  const tmp = `${path}.tmp-${process.pid}`
  await writeFile(tmp, JSON.stringify(snapshot), 'utf8')
  await rename(tmp, path)
}
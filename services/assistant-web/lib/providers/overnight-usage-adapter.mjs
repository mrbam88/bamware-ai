// Read only a metadata-only export, never raw agent results or conversations.
import { readFile, stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
export async function overnightUsageAdapter(file = path.join(os.homedir(), '.local/state/bamware/overnight/usage.json')) {
  try {
    if ((await stat(file)).size > 1024 * 1024) throw new Error('Overnight metadata exceeds size limit');
    const data = JSON.parse(await readFile(file, 'utf8'));
    if (data.version !== 1 || !Array.isArray(data.events)) throw new Error('Invalid overnight metadata');
    return data.events;
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw new Error('Overnight metadata unavailable or invalid');
  }
}

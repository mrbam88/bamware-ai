import {readFile} from 'node:fs/promises';
import {unsupportedWindow} from '../rate-limits.mjs';
export async function codexQuotaAdapter({codexQuotaFile}={}) {
 try {
  const data=JSON.parse(await readFile(codexQuotaFile,'utf8'));
  const windows=data.windows.filter(w=>w.provider==='codex' && w.source?.kind==='live');
  if(windows.length) return windows.map(w=>({provider:'codex',harness:'codex',machine:'X1',scope:w.scope,utilizationPct:w.utilizationPct,
   resetAt:w.resetAt,resetTimezone:'America/New_York',source:{kind:'live',label:'Codex provider quota event · X1',fetchedAt:w.source.fetchedAt},
   notes:'X1 account identity is unknown; may overlap the server account. Not an additional allowance. May become stale when the laptop is offline.'}));
 } catch {}
 return [unsupportedWindow({provider:'codex',scope:'quota',reason:'No Codex provider quota event has been synced from the X1.'})];
}

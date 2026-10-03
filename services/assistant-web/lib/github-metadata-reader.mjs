import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {readGitHubSource} from './scrum-master.mjs';
const execute=promisify(execFile);
export function createGitHubMetadataReader({ghPath=path.join(os.homedir(),'.local/bin/gh'),run=execute}={}) {
  let available=false;try{fs.accessSync(ghPath,fs.constants.X_OK);available=true;}catch{}
  if(!available)return {revision:'public-github-v1',readSource:readGitHubSource};
  return {revision:'existing-local-gh-v1',async readSource(source){
    if(!/^mrbam88\/[a-z0-9-]+$/.test(source.repo)||!['issue','pull'].includes(source.kind)||!Number.isSafeInteger(source.number)||source.number<1)throw Error('Invalid source');
    const endpoint=`repos/${source.repo}/${source.kind==='pull'?'pulls':'issues'}/${source.number}`;
    try {
      const {stdout}=await run(ghPath,['api','--hostname','github.com',endpoint,'--jq','{number,ref:.html_url,state,updatedAt:.updated_at,draft,merged,headRevision:.head.sha}'],{timeout:5000,maxBuffer:64000,encoding:'utf8',windowsHide:true});
      const d=JSON.parse(stdout),ref=`https://github.com/${source.repo}/${source.kind==='pull'?'pull':'issues'}/${source.number}`;
      if(d.number!==source.number||d.ref!==ref||!['open','closed'].includes(d.state)||!Number.isFinite(Date.parse(d.updatedAt)))throw Error();
      return {ref,state:d.state,updatedAt:d.updatedAt,...(source.kind==='pull'?{draft:d.draft===true,merged:d.merged===true,headRevision:typeof d.headRevision==='string'?d.headRevision:null}:{}),transport:'existing-local-gh'};
    } catch {throw Error('Existing GitHub metadata integration unavailable; no auth changes attempted');}
  }};
}

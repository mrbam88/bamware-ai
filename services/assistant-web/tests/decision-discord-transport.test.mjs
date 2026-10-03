import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createDecisionDiscordTransport} from '../lib/decision-discord-transport.mjs';
const config={channelId:'100000000000000000',ownerId:'200000000000000000',token:'fixture-not-a-credential'};
const botId='300000000000000000',threadId='400000000000000000',guildId='500000000000000000';
function fixture(extra=()=>null){const calls=[];const transport=createDecisionDiscordTransport({config,fetchImpl:async(url,init)=>{const route=url.replace('https://discord.com/api/v10','');calls.push({route,...init});const result=extra(route,init);if(result)return result;return Response.json(route==='/users/@me'?{id:botId,bot:true}:route===`/channels/${config.channelId}`?{id:config.channelId,guild_id:guildId,type:0}:{id:threadId,parent_id:config.channelId,guild_id:guildId,type:11,thread_metadata:{}});}});return {transport,calls};}
test('seed suppresses mentions and uses nonce; thread creation derives source id',async()=>{
 const f=fixture((r,i)=>r.includes('/messages')&&i.method==='POST'?Response.json({id:threadId}):null);
 await f.transport.sendMessage(config.channelId,'@everyone fixture','stable-nonce');
 const body=JSON.parse(f.calls[0].body);assert.deepEqual(body.allowed_mentions,{parse:[]});assert.equal(body.enforce_nonce,true);assert.equal(body.nonce,'stable-nonce');
 assert.equal((await f.transport.ensureThread(config.channelId,threadId,'title')).id,threadId);assert.equal(f.calls.filter(x=>x.route.endsWith('/threads')).length,0);
});
test('archived thread reopens same id, locked or foreign thread cannot be used',async()=>{
 const f=fixture((r,i)=>r===`/channels/${threadId}`?Response.json({id:threadId,parent_id:config.channelId,guild_id:guildId,type:11,thread_metadata:{archived:true}}):null);
 await f.transport.checkThread(threadId,config.channelId);assert.deepEqual(JSON.parse(f.calls.find(x=>x.method==='PATCH').body),{archived:false});
 const locked=fixture(r=>r===`/channels/${threadId}`?Response.json({id:threadId,parent_id:config.channelId,guild_id:guildId,type:11,thread_metadata:{locked:true}}):null);
 await assert.rejects(locked.transport.checkThread(threadId,config.channelId),/locked/);assert.equal(locked.calls.some(x=>x.method==='PATCH'),false);
 await assert.rejects(f.transport.checkThread(threadId,'other'),/mismatch/);
});
test('message adoption only accepts configured bot exact marker in queried channel',async()=>{
 const f=fixture(r=>r.includes('/messages?')?Response.json([{id:'600000000000000000',content:'body\n[marker]',author:{id:'wrong'}},{id:'600000000000000001',content:'body\n[marker] extra',author:{id:botId}}]):null);
 assert.equal(await f.transport.findMessage(threadId,{marker:'[marker]',createdAt:new Date().toISOString()}),null);
 assert.ok(f.calls.some(x=>x.route.startsWith(`/channels/${threadId}/messages?`)));
});
test('permission error is explicit; network failure is ambiguous',async()=>{
 const f=fixture(()=>new Response('',{status:403}));await assert.rejects(f.transport.sendMessage(threadId,'fixture','nonce'),e=>e.safeToRetry&&/permission/.test(e.message));
 const t=createDecisionDiscordTransport({config,fetchImpl:async()=>{throw Error('secret HTTP details');}});
 await assert.rejects(t.sendMessage(threadId,'fixture','nonce'),e=>!e.safeToRetry&&!e.message.includes('secret'));
});

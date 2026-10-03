// Input is the already deduplicated event snapshot; never sum project and task rollups.
// Distinct IDs with the same attempt/model/kind may overlap: exclude that group.
export function summarizeWorkCost(events) {
  const groups = new Map();
  const granularities = new Map();
  const ambiguous = new Set();
  const sources = new Set();
  const dates = [];
  for (const [i,e] of events.entries()) {
    const identity = e.attempt.id || e.agent.sessionId || e.id || i;
    const scope = JSON.stringify([identity,e.cost.kind]);
    if(!granularities.has(scope)) granularities.set(scope, []);
    granularities.get(scope).push(e);
    const key = JSON.stringify([identity, e.agent.provider, e.agent.model, e.cost.kind]);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(e);
    if(e.cost.pricingSource) sources.add(`${e.cost.pricingSource}${e.cost.pricingVersion ? ` (${e.cost.pricingVersion})` : ''}`);
    for(const t of [e.timing.startedAt,e.timing.endedAt]) if(t && Number.isFinite(Date.parse(t))) dates.push(t);
  }
  // An attempt total cannot safely be added to model/provider breakdowns.
  for(const values of granularities.values()) {
    const mixedModel = values.some(e=>!e.agent.model) && values.some(e=>e.agent.model);
    const mixedProvider = values.some(e=>!e.agent.provider) && values.some(e=>e.agent.provider);
    if(mixedModel || mixedProvider) for(const e of values) ambiguous.add(e);
  }
  const totals = {estimated:null,billed:null}; let unknown=0;let overlapping=0;
  for(const values of groups.values()) {
    if(values.length>1 || values.some(e=>ambiguous.has(e))){overlapping+=values.length;continue;}
    const c=values[0].cost;
    if(!['estimated','billed'].includes(c.kind)||c.amountUsd==null||c.amountUsd<0){unknown++;continue;}
    totals[c.kind]=(totals[c.kind]??0)+c.amountUsd;
  }
  dates.sort((a,b)=>Date.parse(a)-Date.parse(b));
  return {...totals,incomplete:unknown>0||overlapping>0,unknown,overlapping,sources:[...sources],from:dates[0]??null,to:dates.at(-1)??null,scope:'Recorded work only; not a project budget or subscription bill'};
}

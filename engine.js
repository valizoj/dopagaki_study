(function (root) {
  const round = (n,p) => Number(n.toFixed(p));
  const fmt = n => Number(n).toLocaleString('en-US', {maximumFractionDigits:2});
  const range = d => d.lo === null ? `${fmt(d.hi)}以下` : d.hi === null ? `${fmt(d.lo)}以上` : `${fmt(d.lo)}〜${fmt(d.hi)}`;
  const classify = (d,v) => d.lo !== null && v < d.lo ? 'low' : d.hi !== null && v > d.hi ? 'high' : 'normal';
  function question(d,stage=0,forced,rng=Math.random) {
    const step = 10 ** -d.precision;
    const options = ['normal', ...(d.lo !== null && d.lo > 0 ? ['low'] : []), ...(d.hi !== null ? ['high'] : [])];
    const kind = options.includes(forced) ? forced : options[Math.floor(rng()*options.length)];
    const span = Math.max(step, (d.hi ?? d.lo*1.6) - (d.lo ?? 0));
    const delta = Math.max(step, round(span*(stage >= 2 ? 0.02+rng()*0.12 : 0.18+rng()*0.65),d.precision));
    let value;
    if(kind === 'low') value = Math.max(0,round(d.lo-delta,d.precision));
    else if(kind === 'high') value = round(d.hi+delta,d.precision);
    else {
      // No lower limit was supplied for these items. Keep normal samples near
      // the supplied upper limit instead of inventing a low-value classification.
      const lo=d.lo ?? d.hi*0.65, hi=d.hi ?? d.lo*1.6;
      value=round(lo+rng()*(hi-lo),d.precision);
    }
    return {d,value,answer:classify(d,value)};
  }
  const multiplier = combo => Math.min(3,1+Math.floor(combo/5)*0.5);
  function award(state,correct,fast,now,mode='sort') {
    const fever = state.feverUntil > now;
    if(correct) {
      state.correct++; state.combo++; state.maxCombo=Math.max(state.maxCombo,state.combo);
      state.score += Math.round((100+(fast ? 20 : 0))*multiplier(state.combo)*(fever?2:1));
      if(!fever) {
        state.gauge += mode==='fill' ? 16+(fast?4:0) : mode==='hunt' ? 5+(fast?1:0) : 8+(fast?2:0);
        if(state.gauge>=100) { state.gauge=0; state.feverUntil=now+12000; state.fevers++; }
      }
    } else {
      state.wrong++; state.combo=0; state.gauge=Math.max(0,state.gauge-15);
      if(state.cpu) state.score=Math.max(0,state.score-150); else state.penalty+=2000;
    }
  }
  function cpuProfile(rating,mode) {
    const skill=Math.min(1,Math.max(0,(rating-600)/1800));
    const base=mode==='fill'?6300:mode==='hunt'?2350:3100;
    return {interval:base*(1.45-0.9*skill),accuracy:0.60+0.36*skill};
  }
  function fresh() {return {score:0,combo:0,maxCombo:0,correct:0,wrong:0,gauge:0,feverUntil:0,fevers:0,penalty:0,cpu:false};}
  function retainRecords(records) {
    const keep=new Set(records.slice(0,200)),boards=new Map();
    for(const r of records){if(r.practice||r.aborted)continue;const key=[r.mode,r.group,r.cpu].join(':');if(!boards.has(key))boards.set(key,[]);boards.get(key).push(r);}
    for(const entries of boards.values())entries.sort((a,b)=>b.score-a.score).slice(0,10).forEach(r=>keep.add(r));
    return [...keep].sort((a,b)=>b.at-a.at);
  }
  const api={fmt,range,classify,question,multiplier,award,cpuProfile,fresh,retainRecords};
  root.GameCore=api;
  if(typeof module!=='undefined') module.exports=api;
})(globalThis);

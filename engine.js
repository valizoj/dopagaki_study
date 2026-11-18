(function (root) {
  const round = (n,p) => Number(n.toFixed(p));
  const fmt = n => Number(n).toLocaleString('en-US', {maximumFractionDigits:2});
  const range = d => d.lo === null ? `${fmt(d.hi)}以下` : d.hi === null ? `${fmt(d.lo)}以上` : `${fmt(d.lo)}〜${fmt(d.hi)}`;
  const classify = (d,v) => d.lo !== null && v < d.lo ? 'low' : d.hi !== null && v > d.hi ? 'high' : 'normal';
  function abnormalLimits(d) {
    const step=10**-d.precision;
    // User-selected hypothetical model: bounds = mean ± 2 SD;
    // lower/upper 1% quantiles = mean ± 2.326347874 SD.
    const margin=d.lo!==null&&d.hi!==null?(d.hi-d.lo)/4*(2.326347874-2):Math.max(step*2,(d.lo??d.hi)*.12);
    const low=d.lo===null?null:round((Math.ceil((d.lo-margin)/step-1e-8)-1)*step,d.precision);
    const high=d.hi===null?null:round((Math.floor((d.hi+margin)/step+1e-8)+1)*step,d.precision);
    return {low,high,margin};
  }
  function question(d,stage=0,forced,rng=Math.random) {
    const step = 10 ** -d.precision;
    const limits=abnormalLimits(d);
    const options = ['normal', ...(limits.low!==null&&limits.low>=step?['low']:[]), ...(limits.high!==null?['high']:[])];
    const kind = options.includes(forced) ? forced : options[Math.floor(rng()*options.length)];
    const span = Math.max(step, (d.hi ?? d.lo*1.6) - (d.lo ?? 0));
    const delta = Math.max(0,round(span*rng()*.3,d.precision));
    let value;
    if(kind === 'low') {
      const floor=Math.min(limits.low,Math.max(step,round(d.lo*.55,d.precision)));
      value=Math.max(floor,round(limits.low-delta,d.precision));
    }
    else if(kind === 'high') value = round(limits.high+delta,d.precision);
    else {
      // No lower limit was supplied for these items. Keep normal samples near
      // the supplied upper limit instead of inventing a low-value classification.
      const inner=d.lo!==null&&d.hi!==null?(d.hi-d.lo)*.1:0;
      const lo=Math.max(step,Math.ceil(((d.lo??d.hi*.5)+inner)/step-1e-8)*step),hi=Math.max(lo,Math.floor(((d.hi===null?d.lo*1.6:d.lo===null?d.hi*.9:d.hi)-inner)/step+1e-8)*step);
      value=round(lo+rng()*(hi-lo),d.precision);
    }
    return {d,value,answer:classify(d,value)};
  }
  function choose(q,choice) {
    q.rejected??=[];
    if(q.solved || q.rejected.includes(choice) || !['low','normal','high'].includes(choice))return 'ignored';
    q.revealed=true;
    if(choice===q.answer){q.solved=true;return 'correct';}
    q.rejected.push(choice);
    return 'wrong';
  }
  function numberLine(d,value) {
    const step=10**-d.precision;
    const span=Math.max(step*2,d.lo===null?d.hi*.7:d.hi===null?d.lo*.7:d.hi-d.lo);
    const min=Math.min(value,d.lo??d.hi)-span*(d.lo===null?.85:.3);
    const max=Math.max(value,d.hi??d.lo)+span*(d.hi===null?.85:.3);
    const x=n=>16+(n-min)/(max-min)*288;
    return {lo:d.lo===null?16:x(d.lo),hi:d.hi===null?304:x(d.hi),value:x(value),openLeft:d.lo===null,openRight:d.hi===null};
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
  const api={fmt,range,classify,abnormalLimits,question,choose,numberLine,multiplier,award,cpuProfile,fresh,retainRecords};
  root.GameCore=api;
  if(typeof module!=='undefined') module.exports=api;
})(globalThis);

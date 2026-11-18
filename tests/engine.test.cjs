const {test}=require('node:test');
const assert=require('node:assert/strict');
const D=require('../data.js'), C=require('../engine.js');
test('54 sex-specific ranges; fasting glucose lower bound is 70',()=>{
  assert.equal(D.length,54);assert.equal(new Set(D.map(d=>d.id)).size,54);
  assert.equal(D.find(d=>d.id==='fbs').lo,70);
});
test('inclusive limits, one-sided limits and decimal precision',()=>{
  for(const d of D){
    const step=10**-d.precision;
    if(d.lo!==null){assert.equal(C.classify(d,d.lo),'normal',d.id);assert.equal(C.classify(d,Number((d.lo-step).toFixed(d.precision))),'low',d.id);}
    if(d.hi!==null){assert.equal(C.classify(d,d.hi),'normal',d.id);assert.equal(C.classify(d,Number((d.hi+step).toFixed(d.precision))),'high',d.id);}
  }
  assert.equal(C.classify(D.find(d=>d.id==='db'),0),'normal');
  assert.equal(C.classify(D.find(d=>d.id==='hdl'),100),'normal');
});
test('generated values are positive and abnormalities stay beyond the 1% tails',()=>{
  let seed=17;const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
  for(const d of D)for(let stage=0;stage<4;stage++)for(let i=0;i<500;i++){
    const q=C.question(d,stage,undefined,random);
    assert.ok(q.value>0,d.id);assert.equal(C.classify(d,q.value),q.answer,d.id);
    assert.equal(Number(q.value.toFixed(d.precision)),q.value);
    if(d.lo===null||d.lo===0)assert.notEqual(q.answer,'low');
    if(d.hi===null)assert.notEqual(q.answer,'high');
    if(d.lo!==null&&d.hi!==null){
      const mean=(d.lo+d.hi)/2,sigma=(d.hi-d.lo)/4;
      if(q.answer==='low')assert.ok(q.value<mean-2.326347874*sigma,d.id+' lower 1%');
      if(q.answer==='high')assert.ok(q.value>mean+2.326347874*sigma,d.id+' upper 1%');
    }
  }
});
test('wrong choices are disabled, stay on the same question, and do not score twice',()=>{
  const q={answer:'low',rejected:[]};
  assert.equal(C.choose(q,'high'),'wrong');assert.deepEqual(q.rejected,['high']);assert.equal(q.revealed,true);assert.equal(q.solved,undefined);
  assert.equal(C.choose(q,'high'),'ignored');assert.equal(C.choose(q,'normal'),'wrong');assert.deepEqual(q.rejected,['high','normal']);
  assert.equal(C.choose(q,'low'),'correct');assert.equal(q.solved,true);assert.equal(C.choose(q,'low'),'ignored');
});
test('number line includes both limits and the value, with open single-sided intervals',()=>{
  for(const d of D)for(const kind of ['normal','low','high']){
    const q=C.question(d,0,kind),g=C.numberLine(d,q.value);
    assert.ok(g.lo>=16&&g.hi<=304&&g.lo<g.hi,d.id);
    assert.ok(g.value>=16&&g.value<=304,d.id);
    if(q.answer==='low')assert.ok(g.value<g.lo,d.id);
    if(q.answer==='high')assert.ok(g.value>g.hi,d.id);
    if(q.answer==='normal')assert.ok(g.value>=g.lo&&g.value<=g.hi,d.id);
    assert.equal(g.openLeft,d.lo===null);assert.equal(g.openRight,d.hi===null);
  }
});
test('rounding at extreme random samples cannot create zero or borderline abnormalities',()=>{
  for(const d of D)for(const r of [0,.000001,.999999])for(const kind of ['normal','low','high']){
    const q=C.question(d,3,kind,()=>r),limits=C.abnormalLimits(d);
    assert.ok(q.value>0,d.id);if(q.answer==='low')assert.ok(q.value<=limits.low);if(q.answer==='high')assert.ok(q.value>=limits.high);
  }
  const k=C.abnormalLimits(D.find(d=>d.id==='k'));assert.equal(k.low,3.4);assert.equal(k.high,5.2);
});
test('forced hunt abnormalities are actually abnormal, including HDL',()=>{
  for(const d of D){assert.notEqual(C.question(d,0,d.hi===null?'low':'high').answer,'normal');assert.equal(C.question(d,3,'normal').answer,'normal');}
});
test('combo caps, fever lasts 12s and cannot refill during fever',()=>{
  const s=C.fresh();for(let i=0;i<10;i++)C.award(s,true,true,i*500);
  assert.equal(s.fevers,1);assert.equal(s.feverUntil,16500);assert.equal(s.gauge,0);
  const before=s.score;C.award(s,true,false,5100);assert.equal(s.score-before,400);
  C.award(s,false,false,5500);assert.equal(s.combo,0);assert.equal(s.penalty,2000);assert.equal(s.feverUntil,16500);
  C.award(s,true,false,17000);assert.equal(s.gauge,8);
  assert.equal(C.multiplier(200),3);
});
test('CPU penalty does not shorten shared match and score stays nonnegative',()=>{
  const s={...C.fresh(),cpu:true,score:100};C.award(s,false,false,1000);
  assert.equal(s.penalty,0);assert.equal(s.score,0);assert.equal(s.wrong,1);
  for(const mode of ['sort','fill','hunt']){assert.ok(C.cpuProfile(2200,mode).interval<C.cpuProfile(600,mode).interval);assert.ok(C.cpuProfile(2200,mode).accuracy>C.cpuProfile(600,mode).accuracy);}
});
test('old personal best survives trimming while recent history stays bounded',()=>{
  const rows=Array.from({length:1000},(_,i)=>({at:1000-i,mode:'sort',group:'全項目',cpu:false,practice:false,aborted:false,score:i===999?99999:i%20}));
  const retained=C.retainRecords(rows);assert.ok(retained.some(r=>r.score===99999));assert.ok(retained.includes(rows[199]));assert.ok(retained.length<=210);
  assert.equal(retained[0].at,1000);
});

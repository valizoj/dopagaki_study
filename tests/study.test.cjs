const {test}=require('node:test');
const assert=require('node:assert/strict');
const S=require('../study.js'),D=require('../data.js'),C=require('../engine.js');
let seed=124;const rng=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
test('all bounds get four unique sorted, spaced choices including the exact answer',()=>{
  for(const d of D)for(const side of ['lo','hi'])if(d[side]!==null)for(let i=0;i<100;i++){
    const a=S.choices(d,side,rng);assert.equal(a.length,4);assert.equal(new Set(a).size,4,d.id);
    assert.ok(a.includes(d[side]),d.id);assert.ok(a.every(v=>v>=0&&!Object.is(v,-0)));assert.deepEqual(a,[...a].sort((x,y)=>x-y));
    assert.ok(a[1]-a[0]>=.01-1e-8);
  }
});
test('the eight paired choices read in ascending order down the left then the right column',()=>{
  for(const d of D.filter(d=>d.lo!==null&&d.hi!==null))for(let i=0;i<100;i++){
    const q=S.newInput(d,false,1,rng),all=[...q.options.lo,...q.options.hi];
    assert.equal(new Set(all).size,8,d.id);assert.deepEqual(all,[...all].sort((a,b)=>a-b),d.id);
  }
});
test('lower then upper: reject wrong buttons, award only a full answer; single-sided has no invented bound',()=>{
  const d=D.find(d=>d.id==='fbs'),q=S.newInput(d,false,1,rng);
  assert.equal(d.short,'空腹時血糖');assert.equal(q.kind,'choice');assert.equal(q.side,'lo');
  assert.equal(S.inputAnswer(q,50),'wrong');assert.equal(S.inputAnswer(q,50),'ignored');assert.equal(q.side,'lo');
  assert.equal(S.inputAnswer(q,70),'next-bound');assert.equal(q.side,'hi');
  assert.equal(S.inputAnswer(q,110),'complete');assert.equal(q.failed,true);assert.equal(S.inputAnswer(q,110),'ignored');
  const one=S.newInput(D.find(d=>d.id==='crp'),true,2);assert.deepEqual(one.sides,['hi']);assert.equal(S.inputAnswer(one,.3),'complete');
});
test('failure is due soon; clean typed recalls progressively extend to days; choice does not erase mastery',()=>{
  const failed=S.review(null,false,'choice',1000);assert.equal(failed.dueAt,13000);assert.equal(failed.lapses,1);
  const choice=S.review(null,true,'choice',1000);assert.equal(choice.dueAt,31000);
  let rec=choice,previous=0;for(let i=0;i<10;i++){rec=S.review(rec,true,'keypad',1000);assert.ok(rec.interval>previous);previous=rec.interval;}
  assert.equal(rec.interval,5184000000);assert.equal(S.review(rec,true,'choice',1000).interval,rec.interval);
  const lapse=S.review(rec,false,'keypad',1000);assert.equal(lapse.streak,0);assert.equal(lapse.interval,12000);
});
test('scheduler prioritizes due errors, interleaves new items, and never repeats a not-due item',()=>{
  const pool=D.slice(0,3),a=pool[0].id,b=pool[1].id,c=pool[2].id;
  const records={[a]:S.review(null,false,'choice',0),[b]:S.review(null,true,'choice',0)};
  assert.equal(S.nextStudy(pool,records,1000,null,rng).id,c);
  assert.equal(S.nextStudy(pool,records,13000,c,rng).id,a);
  records[c]=S.review(null,true,'choice',1000);assert.equal(S.nextStudy(pool,records,1000,null,rng),null);
  assert.ok(S.validRecords(records,D.map(d=>d.id)));assert.equal(S.validRecords({fake:records[a]},D.map(d=>d.id)),false);
  assert.equal(S.validRecords({[a]:{...records[a],streak:NaN}},D.map(d=>d.id)),false);
});
test('XP thresholds increase and boundaries have no off-by-one; large old XP remains usable',()=>{
  assert.deepEqual([0,1,2,3,4].map(S.levelThreshold),[0,500,1175,2075,3250]);
  for(let n=1;n<100;n++){assert.equal(S.levelInfo(S.levelThreshold(n)).level,n+1);assert.equal(S.levelInfo(S.levelThreshold(n)-1).level,n);}
  for(const xp of [0,499,500,1e10]){const i=S.levelInfo(xp);assert.ok(i.fraction>=0&&i.fraction<1);assert.equal(S.levelThreshold(i.level-1)+i.progress,xp);}
});
test('race: first correct closes, one mistake locks only that player, two mistakes skip, deadline rejects',()=>{
  const r=S.newRace(0,6000,1000,rng);
  assert.equal(S.raceAnswer(r,'player',false,100),'locked');assert.equal(S.raceAnswer(r,'player',true,200),'ignored');
  assert.equal(S.raceAnswer(r,'bot',true,300),'won');assert.equal(r.winner,'bot');assert.equal(S.raceAnswer(r,'bot',true,400),'ignored');
  const both=S.newRace(0,6000,1000,rng);S.raceAnswer(both,'bot',false,100);assert.equal(S.raceAnswer(both,'player',false,200),'skip');
  assert.equal(S.raceAnswer(S.newRace(0,6000,1000,rng),'player',true,6000),'ignored');
  const weak=S.newRace(0,6000,600,()=>.8),strong=S.newRace(0,6000,2400,()=>.8);assert.ok(strong.botAt<weak.botAt);assert.equal(weak.botCorrect,false);assert.equal(strong.botCorrect,true);
  const score={...C.fresh(),cpu:true,rule:'race',score:500};C.award(score,false,false,0);assert.equal(score.score,500);assert.equal(score.penalty,0);
});
test('case sheet has every applicable finding, one sex, and correct abnormal counts',()=>{
  for(let i=0;i<100;i++)for(const pool of [D,D.filter(d=>d.group==='免疫学'),D.filter(d=>d.sex==='女性'),D.filter(d=>d.sex==='男性')]){
    const c=S.makeCase(pool,i,C,rng);assert.ok(c.total>0);assert.equal(c.rows.length,pool.filter(d=>!d.sex||d.sex===c.sex).length);
    assert.equal(new Set(c.rows.map(q=>q.d.id)).size,c.rows.length);assert.ok(c.rows.every(q=>!q.d.sex||q.d.sex===c.sex));
    assert.equal(c.total,c.rows.filter(q=>q.answer!=='normal').length);assert.ok(c.rows.every(q=>q.value>0));
  }
});
test('uncommon abnormal directions are rare but possible, including forced abnormalities in PICK',()=>{
  for(const [id,rare] of [['ast','low'],['alt','low'],['alb','high']]){
    const d=D.find(d=>d.id===id),counts={low:0,high:0};for(let i=0;i<10000;i++)counts[C.question(d,0,'abnormal',rng).answer]++;
    assert.ok(counts[rare]>200);assert.ok(counts[rare]<2200);
  }
});
test('90ms tap / 130ms transition guard prevents repeated acceptance without extending rejected taps',()=>{
  const g=new S.InputGate();assert.equal(g.accept(0),true);assert.equal(g.accept(70),false);assert.equal(g.accept(91),true);
  g.transition(100);assert.equal(g.accept(220),false);assert.equal(g.accept(231),true);
});

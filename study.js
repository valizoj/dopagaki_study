(function(root){
  const round=(x,p)=>Number(x.toFixed(p));
  const intervals=[90000,300000,1800000,21600000,86400000,259200000,604800000,1209600000,2592000000,5184000000];
  function review(previous,clean,kind,now){
    const p=previous??{streak:0,seen:0,lapses:0};
    const streak=clean?(kind==='keypad'?p.streak+1:p.streak):0;
    const interval=clean?(kind==='choice'?Math.max(30000,p.interval??0):intervals[Math.min(intervals.length-1,streak-1)]):12000;
    return {streak,seen:p.seen+1,lapses:p.lapses+(clean?0:1),lastAt:now,dueAt:now+interval,interval};
  }
  function nextStudy(pool,records,now,lastId,rng=Math.random){
    const due=pool.filter(d=>records[d.id]&&records[d.id].dueAt<=now).sort((a,b)=>records[a.id].dueAt-records[b.id].dueAt);
    const fresh=pool.filter(d=>!records[d.id]);
    if(due.length)return due.find(d=>d.id!==lastId)??due[0];
    return fresh.length?fresh[Math.floor(rng()*fresh.length)]:null;
  }
  function choices(d,side,rng=Math.random){
    const target=d[side],step=10**-d.precision,span=d.hi!==null&&d.lo!==null?d.hi-d.lo:Math.max(target*.5,step*3);
    const raw=d.id==='ph'?.1:Math.max(step,span*.4,Math.abs(target)*.08)*(0.85+rng()*.5);
    const pow=10**Math.floor(Math.log10(raw)),mantissa=raw/pow;
    const nice=(mantissa<1.5?1:mantissa<3.5?2:mantissa<7.5?5:10)*pow;
    const gap=Math.max(step,round(nice,d.precision));
    const slots=Math.min(3,Math.floor((target+1e-9)/gap));
    const indexes=Array.from({length:slots+1},(_,i)=>i);
    const middle=d.lo!==null&&d.hi!==null?(d.lo+d.hi)/2:null;
    const separated=middle===null?indexes:indexes.filter(i=>side==='lo'?target+(3-i)*gap<middle:target-i*gap>middle);
    const allowed=separated.length?separated:indexes,correctIndex=allowed[Math.floor(rng()*allowed.length)];
    return Array.from({length:4},(_,i)=>Math.max(0,round(target+(i-correctIndex)*gap,d.precision)));
  }
  function newInput(d,keypad,uid,rng=Math.random){
    const sides=['lo','hi'].filter(s=>d[s]!==null);
    return {d,uid,sides,phase:0,side:sides[0],answer:d[sides[0]],kind:keypad?'keypad':'choice',failed:false,answers:{},rejected:{lo:[],hi:[]},options:Object.fromEntries(sides.map(s=>[s,choices(d,s,rng)]))};
  }
  function inputAnswer(q,value){
    if(q.done||(q.kind==='choice'&&q.rejected[q.side].includes(value)))return 'ignored';
    if(value!==q.answer){q.failed=true;q.rejected[q.side].push(value);return 'wrong';}
    q.answers[q.side]=value;
    if(q.phase===q.sides.length-1){q.done=true;return 'complete';}
    q.phase++;q.side=q.sides[q.phase];q.answer=q.d[q.side];return 'next-bound';
  }
  function levelThreshold(n){return 500*n+75*n*(n-1)+25*n*(n-1)*(2*n-1)/6;}
  function levelInfo(xp){
    let lo=0,hi=1;while(levelThreshold(hi)<=xp)hi*=2;
    while(lo+1<hi){const mid=Math.floor((lo+hi)/2);if(levelThreshold(mid)<=xp)lo=mid;else hi=mid;}
    const needed=500+150*lo+25*lo*lo,progress=xp-levelThreshold(lo);
    return {level:lo+1,progress,needed,fraction:progress/needed};
  }
  class InputGate{
    constructor(){this.until=0;}
    accept(now){if(now<this.until)return false;this.until=now+90;return true;}
    transition(now){this.until=Math.max(this.until,now+130);}
  }
  function newRace(start,limit,rating,rng=Math.random){
    const skill=Math.max(0,Math.min(1,(rating-600)/1800));
    const delay=Math.max(650,(3100-1900*skill)*(.72+rng()*.55));
    return {start,deadline:start+limit,botAt:start+delay,botCorrect:rng()<.65+skill*.3,playerLocked:false,botLocked:false,botAnswered:false,closed:false,winner:null};
  }
  function raceAnswer(r,actor,correct,at){
    if(r.closed||r[actor+'Locked']||at>=r.deadline)return 'ignored';
    if(correct){r.closed=true;r.winner=actor;return 'won';}
    r[actor+'Locked']=true;
    if(r.playerLocked&&r.botLocked){r.closed=true;return 'skip';}return 'locked';
  }
  function makeCase(pool,number,core,rng=Math.random){
    const sexes=['男性','女性'].filter(sex=>pool.some(d=>!d.sex||d.sex===sex));
    const sex=sexes[Math.floor(rng()*sexes.length)],selected=pool.filter(d=>!d.sex||d.sex===sex);
    const count=Math.max(1,Math.round(selected.length*(.17+rng()*.1)));
    const indexes=selected.map((_,i)=>i);for(let i=indexes.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[indexes[i],indexes[j]]=[indexes[j],indexes[i]];}
    const abnormal=new Set(indexes.slice(0,count));
    return {number,sex,found:0,total:count,rows:selected.map((d,i)=>({...core.question(d,0,abnormal.has(i)?'abnormal':'normal',rng),picked:false,missed:false}))};
  }
  function validRecords(records,ids){
    if(!records||typeof records!=='object'||Array.isArray(records)||Object.keys(records).length>ids.length)return false;
    return Object.entries(records).every(([id,r])=>ids.includes(id)&&r&&['streak','seen','lapses','lastAt','dueAt','interval'].every(k=>Number.isFinite(r[k])&&r[k]>=0&&r[k]<=1e14)&&Number.isInteger(r.streak)&&Number.isInteger(r.seen)&&Number.isInteger(r.lapses)&&r.interval<=5184000000&&r.dueAt>=r.lastAt);
  }
  const api={review,nextStudy,choices,newInput,inputAnswer,levelInfo,levelThreshold,InputGate,newRace,raceAnswer,makeCase,validRecords};
  root.Study=api;if(typeof module!=='undefined')module.exports=api;
})(globalThis);

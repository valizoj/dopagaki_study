(() => {
  'use strict';
  const C=GameCore, $=s=>document.querySelector(s), app=$('#app'), overlay=$('#overlay');
  const names={sort:'CHECK',fill:'INPUT',hunt:'PICK'}, labels={low:'低値',normal:'正常',high:'高値'};
  const groups=['全項目','血液学','生化学','免疫学','血液ガス'];
  const icons={gear:'<circle cx="12" cy="12" r="3"/><path d="m9 3 1-1h4l1 3 3 1 3 1 1 4-2 2-1 3-1 3-4 1-2-2-3-1-3-1-1-4 2-2 1-3 1-3z"/>',book:'<path d="M12 5v15M3 4c4-1 6 0 9 2 3-2 5-3 9-2v15c-4-1-6 0-9 2-3-2-5-3-9-2z"/>',chart:'<path d="M4 20V10h4v10m4 0V4h4v16m4 0v-7h2v7"/>',close:'<path d="m6 6 12 12M18 6 6 18"/>',back:'<path d="m14 5-7 7 7 7"/>'};
  const svg=name=>`<svg viewBox="0 0 24 24" aria-hidden="true">${icons[name]}</svg>`;
  const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const key='dopalab-v1';
  const defaults=()=>({version:1,xp:0,ratings:{sort:1000,fill:1000,hunt:1000},records:[],settings:{bgm:true,se:true,bgmVolume:0.35,seVolume:0.65,reduced:false}});
  let storageOK=true, profile=defaults(), mode='sort', cpu=false, group='全項目', game=null, result=null, screen='home', frame=0, xpFrame=0, lastFocus=null;
  function validProfile(p) {
    if(!p || p.version!==1 || !Number.isFinite(p.xp) || p.xp<0 || p.xp>1e10 || !p.ratings || !p.settings || !Array.isArray(p.records) || p.records.length>500) return false;
    if(!Object.keys(names).every(k=>Number.isFinite(p.ratings[k])&&p.ratings[k]>=400&&p.ratings[k]<=5000)) return false;
    const s=p.settings;
    if(!['bgm','se','reduced'].every(k=>typeof s[k]==='boolean') || !['bgmVolume','seVolume'].every(k=>Number.isFinite(s[k])&&s[k]>=0&&s[k]<=1)) return false;
    return p.records.every(r=>r&&Object.hasOwn(names,r.mode)&&groups.includes(r.group)&&typeof r.cpu==='boolean'&&typeof r.practice==='boolean'&&typeof r.aborted==='boolean'&&Number.isFinite(r.at)&&['score','correct','wrong','maxCombo'].every(k=>Number.isFinite(r[k])&&r[k]>=0&&r[k]<=1e9));
  }
  try {const raw=localStorage.getItem(key);if(raw){const p=JSON.parse(raw);if(validProfile(p))profile=p;else storageOK=false;}}catch{storageOK=false;}
  function save(){try{localStorage.setItem(key,JSON.stringify(profile));storageOK=true;}catch{storageOK=false;toast('記録を保存できません。設定から書き出せます。');}}
  function toast(text){const el=$('#toast');el.textContent=text;el.classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>el.classList.remove('show'),2600);}
  function motion(){document.body.classList.toggle('reduced',profile.settings.reduced);}
  motion();
  const audio={ctx:null,beat:0,timer:null,
    async unlock(){try{this.ctx??=new (window.AudioContext||window.webkitAudioContext)();if(this.ctx.state==='suspended')await this.ctx.resume();}catch{}},
    tone(freq,duration,volume,type='sine',delay=0,bus='se'){
      const s=profile.settings;if(!this.ctx || this.ctx.state!=='running' || !s[bus] || volume===0)return;
      const t=this.ctx.currentTime+delay,osc=this.ctx.createOscillator(),gain=this.ctx.createGain();
      osc.type=type;osc.frequency.setValueAtTime(freq,t);gain.gain.setValueAtTime(0.0001,t);gain.gain.exponentialRampToValueAtTime(Math.max(.0001,volume*s[bus+'Volume']),t+.005);gain.gain.exponentialRampToValueAtTime(.0001,t+duration);
      osc.connect(gain);gain.connect(this.ctx.destination);osc.start(t);osc.stop(t+duration+.01);
    },
    hit(ok,combo){if(ok){this.tone(440*2**((combo%8)/12),.09,.16,'triangle');this.tone(880,.035,.04,'square');}else{this.tone(110,.13,.18,'sawtooth');this.tone(82,.12,.13,'triangle',.04);}},
    jackpot(){[523,659,784,1047].forEach((f,i)=>this.tone(f,.14,.1,'triangle',i*.035));this.tone(65,.17,.16,'sine');},
    fever(){[440,554,659,880].forEach((f,i)=>this.tone(f,.15,.12,'triangle',i*.04));},
    start(){
      if(this.timer)return;
      const beat=()=>{
        if(game&&!game.paused&&game.countdown===0&&screen==='game'){
          const fever=game.feverUntil>game.elapsed,b=this.beat++,notes=[110,110,164.81,146.83,110,130.81,164.81,196];
          if(b%2===0)this.tone(notes[(b/2)%8],.13,.07,'triangle',0,'bgm');
          if(b%4===0)this.tone(55,.11,.14,'sine',0,'bgm');
          if(game.stage>=1&&b%4===2)this.tone(220,.05,.025,'triangle',0,'bgm');
          if(fever){this.tone(880+(b%4)*220,.025,.018,'square',0,'bgm');if(b%2===1)this.tone(notes[b%8]*4,.08,.035,'triangle',0,'bgm');}
        }
        this.timer=setTimeout(beat,game?125-game.stage*8:250);
      };
      beat();
    }
  };
  function home(){
    cancelAnimationFrame(frame);cancelAnimationFrame(xpFrame);game=null;screen='home';overlay.hidden=true;document.body.style.overflow='';
    const level=1+Math.floor(profile.xp/500),xp=profile.xp%500;
    app.innerHTML=`<div class="shell home"><header class="topbar"><span class="home-mark" aria-hidden="true">ϟ</span><button class="icon-btn" data-action="settings" aria-label="設定">${svg('gear')}</button></header>
      <div class="profile"><div class="profile-info"><strong>LV.${String(level).padStart(2,'0')}</strong><div class="xp-line"><i style="width:${xp/5}%"></i></div></div><span class="xp-total">${xp} / 500 XP</span></div>
      <section class="hero"><div class="title-spark" aria-hidden="true">✦</div><h1>フラッシュ検査</h1></section>
      <div class="play-options"><div class="segmented"><button data-versus="false" class="${!cpu?'active':''}" aria-pressed="${!cpu}">SOLO</button><button data-versus="true" class="${cpu?'active':''}" aria-pressed="${cpu}">CPU</button></div><select class="field-select" id="group" aria-label="出題分野">${groups.map(g=>`<option ${g===group?'selected':''}>${g}</option>`).join('')}</select></div>
      <div class="modes">${Object.entries(names).map(([id,name],i)=>`<button class="mode" data-mode="${id}" aria-label="${name}"><span class="mode-icon" aria-hidden="true">${['⇅','123','⌖'][i]}</span><strong>${name}</strong>${cpu?`<small>${profile.ratings[id]}</small>`:''}</button>`).join('')}</div>
      <nav class="home-links"><button class="quiet-button" data-action="reference">${svg('book')} 基準値一覧</button><button class="quiet-button" data-action="records">${svg('chart')} 記録</button></nav>
      ${!storageOK?'<p class="storage-warning">記録を保存できません</p>':''}</div>`;
  }
  function shuffled(arr){const a=[...arr];for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
  function pick(){
    game.sequence++;
    const due=game.sequence%3===0?game.repeats.findIndex(r=>r.due<=game.sequence):-1;
    if(due>=0)return game.repeats.splice(due,1)[0].d;
    if(!game.deck.length)game.deck=shuffled(game.pool);
    return game.deck.pop();
  }
  function makeQ(){const d=pick(),uid=++game.serial;if(mode==='fill'){const side=d.lo===null?'hi':d.hi===null?'lo':Math.random()<.5?'lo':'hi';return {d,uid,side,answer:d[side]};}return {...C.question(d,game.stage),uid,rejected:[]};}
  function start(reviewIds){
    cancelAnimationFrame(xpFrame);overlay.hidden=true;audio.unlock();audio.start();screen='game';document.body.style.overflow='hidden';
    const pool=reviewIds?LAB.filter(d=>reviewIds.includes(d.id)):LAB.filter(d=>group==='全項目'||d.group===group);
    game={...C.fresh(),mode,cpu:cpu&&!reviewIds,practice:!!reviewIds,pool:pool.length?pool:LAB,deck:[],repeats:[],sequence:0,serial:0,history:[],queue:[],errors:[],elapsed:0,last:performance.now(),stage:0,paused:false,qStart:0,input:'',next:null,countdown:1500,countBeat:0,bot:{...C.fresh(),cpu:true},botAt:1800,botProfile:C.cpuProfile(profile.ratings[mode],mode),reviewIds};
    if(game.cpu&&group!=='全項目')game.practice=true;
    renderGame();advance();countdownDisplay();cancelAnimationFrame(frame);frame=requestAnimationFrame(tick);
  }
  function renderGame(){
    app.innerHTML=`<section class="game ${mode} counting" id="game"><div class="light-rail left"></div><div class="light-rail right"></div><canvas id="fx" aria-hidden="true"></canvas><header class="game-head"><button class="icon-btn back-small" data-action="settings" aria-label="一時停止・設定">${svg('gear')}</button><div class="clock" id="clock">2:00</div><div class="scorebox"><small>SCORE</small><strong id="score">0</strong></div></header><div class="session-track"><i id="session-bar"></i></div>
      <div class="game-status"><span id="stage">STAGE 01 / 04</span><span id="game-type">${names[mode]} · ${game.practice?'練習':game.cpu?'CPU':'SOLO'}${group!=='全項目'?' · '+group:''}</span></div>
      ${game.cpu?'<div class="versus"><span>CPU <b id="bot-score">0</b></span><span id="lead">± 0</span></div>':''}
      <div class="chain-display" id="chain"><strong>00</strong><span>COMBO</span><em>×1</em></div>
      <div class="playfield"><div class="question-area ${mode==='sort'?'reel':''}" id="question"></div>${mode==='sort'?'':'<div class="correction" id="correction"></div>'}</div>
      <div class="fever-row"><div class="fever-caption"><span id="fever-label">FEVER</span><b id="combo">×1</b></div><div class="fever-track"><i id="fever-bar"></i></div></div>
      <div id="controls" class="controls"></div><div id="countdown" class="countdown" role="status"><strong>3</strong></div></section>`;
    game.effects=new LabUI.Effects($('#fx'));
    const controls=$('#controls');
    if(mode==='sort')controls.innerHTML=['low','normal','high'].map((v,i)=>`<button class="answer-btn raised" data-answer="${v}"><span aria-hidden="true">${['↓','＝','↑'][i]}</span>${['Low','Normal','High'][i]}</button>`).join('');
    else if(mode==='fill'){controls.classList.add('keypad');controls.innerHTML=['1','2','3','4','5','6','7','8','9','.','0','erase','clear','enter'].map(k=>`<button class="key raised ${k==='enter'?'confirm':''} ${k==='erase'?'erase':''}" data-key="${k}" aria-label="${k==='erase'?'一文字消す':k==='clear'?'入力を消す':k==='enter'?'確定':k}">${k==='erase'?'⌫':k==='clear'?'C':k==='enter'?'ENTER':k}</button>`).join('');}
    else controls.hidden=true;
  }
  function countdownDisplay(){
    const n=Math.ceil(game.countdown/500),el=$('#countdown');
    if(n!==game.countBeat){game.countBeat=n;if(n){el.querySelector('strong').textContent=n;audio.tone(440+(3-n)*110,.09,.14,'triangle');}else audio.tone(880,.16,.18,'triangle');}
    el.hidden=n===0;$('#game').classList.toggle('counting',n>0);
  }
  function reelCard(q,slot){
    const d=q.d;
    return `<div class="lab-heading"><h2 class="lab-name">${d.short}</h2>${LabUI.sexBadge(d.sex)}</div><div class="lab-reading"><strong class="lab-value">${C.fmt(q.value)}</strong><b class="lab-unit">${d.unit}</b></div><div class="range-slot">${q.revealed?LabUI.numberLine(q,!!q.solved):''}</div>${slot==='current'?'<div class="card-clock"><i id="q-bar"></i></div>':''}`;
  }
  function renderReel(){
    const root=$('#question'),slots=[{q:game.history[1],slot:'edge-before'},{q:game.history[0],slot:'previous'},{q:game.q,slot:'current'},{q:game.queue[0],slot:'upcoming'},{q:game.queue[1],slot:'edge-after'}];
    const keep=new Set();
    for(const {q,slot} of slots){
      const id=q?'q'+q.uid:'blank-'+slot;keep.add(id);
      let card=[...root.children].find(el=>el.dataset.reelId===id);
      if(!card){card=document.createElement('article');card.dataset.reelId=id;root.append(card);}
      card.className=`reel-card ${slot}${q?.solved?' solved '+q.answer:''}${q?.expired?' expired':''}${!q?' blank':''}`;
      card.dataset.slot=slot;
      card.innerHTML=q?reelCard(q,slot):'<i></i><i></i>';
      card.setAttribute('aria-hidden',String(!q||slot.startsWith('edge')));
    }
    [...root.children].forEach(el=>{if(!keep.has(el.dataset.reelId))el.remove();});
    document.querySelectorAll('[data-answer]').forEach(el=>{el.disabled=game.q.rejected.includes(el.dataset.answer);});
  }
  function qLimit(){return (mode==='fill'?[12,11,10,9]:mode==='hunt'?[10,9,8,7]:[5,4,3.5,2.8])[game.stage]*1000;}
  function advance(){
    if(!game||screen!=='game')return;
    game.qStart=game.elapsed;game.limit=qLimit();game.input='';
    if(mode==='sort'){
      if(game.q){game.history.unshift(game.q);game.history=game.history.slice(0,2);}
      game.q=game.queue.shift()??makeQ();while(game.queue.length<2)game.queue.push(makeQ());renderReel();
    } else if(mode==='hunt'){
      const count=1+Math.floor(Math.random()*3),ds=[];let attempts=0;
      while(ds.length<4&&attempts++<100){const d=pick();if(!ds.some(x=>x.id===d.id)||game.pool.length<4)ds.push(d);}
      game.cards=shuffled(ds.map((d,i)=>{
        const limits=C.abnormalLimits(d),abnormal=d.hi===null?'low':limits.low>0&&Math.random()<.5?'low':'high';
        return {...C.question(d,game.stage,i<count?abnormal:'normal'),uid:++game.serial,picked:false,missed:false};
      }));game.remaining=count;
      $('#question').innerHTML=`<div class="hunt-label"><span id="hunt-progress">0 PICKED</span></div><div class="hunt-grid">${game.cards.map((q,i)=>`<button class="hunt-card raised" data-card="${i}"><span class="hunt-title"><span class="hunt-name">${q.d.short}</span>${LabUI.sexBadge(q.d.sex)}</span><span class="hunt-value">${C.fmt(q.value)}</span><span class="hunt-unit">${q.d.unit}</span></button>`).join('')}</div><div class="q-progress"><i id="q-bar"></i></div>`;
    } else {
      game.q=game.next??makeQ();game.next=makeQ();const q=game.q,d=q.d;
      const value=`<div class="fill-range">${d.lo===null?'<span class="input-answer" id="input-answer">?</span><span>以下</span>':d.hi===null?'<span class="input-answer" id="input-answer">?</span><span>以上</span>':q.side==='lo'?`<span class="input-answer" id="input-answer">?</span><span>〜 ${C.fmt(d.hi)}</span>`:`<span>${C.fmt(d.lo)} 〜</span><span class="input-answer" id="input-answer">?</span>`}</div>`;
      $('#question').innerHTML=`<div class="question-card"><div class="lab-heading"><h2 class="question-symbol">${d.short}</h2>${LabUI.sexBadge(d.sex)}</div>${value}<div class="question-unit">${d.unit||' '}</div></div><div class="q-progress"><i id="q-bar"></i></div>`;
    }
  }
  function logError(q,response){
    const d=q.d;game.errors.push({id:d.id,value:q.value??null,side:q.side??null,response:String(response),answer:q.side?C.fmt(q.answer):labels[q.answer]});
    if(game.repeats.length<8&&!game.repeats.some(r=>r.d.id===d.id))game.repeats.push({d,due:game.sequence+4});
  }
  function feedback(ok,q,response){
    const before=game.score,wasFever=game.feverUntil>game.elapsed;
    C.award(game,ok,!q.rejected?.length&&game.elapsed-game.qStart<game.limit*.42,game.elapsed,mode);
    audio.hit(ok,game.combo);if(!wasFever&&game.feverUntil>game.elapsed)audio.fever();
    const correction=$('#correction');
    if(correction){correction.className='correction '+(ok?'good':'wrong');correction.innerHTML=`<strong>${ok?'✓':'×'} ${q.d.short} ${LabUI.sexBadge(q.d.sex)}　${C.range(q.d)} ${q.d.unit}</strong>`;}
    if(!ok)logError(q,response);
    const reduced=profile.settings.reduced||matchMedia('(prefers-reduced-motion: reduce)').matches;
    if(ok)game.effects.burst(game.combo,game.feverUntil>game.elapsed,reduced);
    if(!reduced){
      const pop=document.createElement('div');pop.className='points-pop'+(ok?'':' bad');pop.textContent=ok?'+'+(game.score-before):game.cpu?'−150':'−2 SEC';$('#game').append(pop);setTimeout(()=>pop.remove(),500);
      if(ok&&game.combo%5===0){const chip=document.createElement('div');chip.className='combo-chip';chip.textContent=game.combo+' COMBO';$('#game').append(chip);setTimeout(()=>chip.remove(),600);audio.jackpot();}
    }
    hud();
  }
  function syncClock(){if(!game||game.paused||game.countdown>0||screen!=='game')return false;step(performance.now());if(game.elapsed+game.penalty>=120000){finish();return false;}if(game.elapsed-game.qStart>=game.limit){timeout();return false;}return screen==='game';}
  function answer(v){
    if(!syncClock())return;const q=game.q,status=C.choose(q,v);if(status==='ignored')return;
    feedback(status==='correct',q,v);if(checkEnd())return;
    if(status==='correct')advance();
    else{game.qStart=game.elapsed;game.limit=qLimit();renderReel();}
  }
  function enterKey(k){if(!syncClock())return;if(k==='enter'){if(game.input===''||game.input==='.')return;const q=game.q;feedback(Number(game.input)===q.answer,q,game.input);if(!checkEnd())advance();return;}if(k==='erase')game.input=game.input.slice(0,-1);else if(k==='clear')game.input='';else if(k==='.'&&!game.input.includes('.'))game.input=(game.input||'0')+'.';else if(/^\d$/.test(k)&&game.input.length<8)game.input+=k;$('#input-answer').textContent=game.input||'?';}
  function pickCard(index){if(!syncClock())return;const q=game.cards[index];if(!q||q.picked||q.missed)return;const ok=q.answer!=='normal';q[ok?'picked':'missed']=true;feedback(ok,q,'選択');if(checkEnd())return;const el=$(`[data-card="${index}"]`);el.disabled=true;el.classList.add(ok?'picked':'missed');if(ok)game.remaining--;$('#hunt-progress').textContent=game.cards.filter(x=>x.picked).length+' PICKED';if(game.remaining===0)advance();}
  function timeout(){if(mode==='hunt'){const missed=game.cards.filter(q=>q.answer!=='normal'&&!q.picked);if(missed.length){feedback(false,missed[0],'時間切れ');missed.slice(1).forEach(q=>logError(q,'時間切れ'));}}else{game.q.revealed=true;game.q.expired=true;feedback(false,game.q,'時間切れ');}if(!checkEnd())advance();}
  function checkEnd(){if(game.elapsed+game.penalty>=120000){finish();return true;}return false;}
  function step(now){const delta=now-game.last;game.last=now;if(game.countdown>0){game.countdown=Math.max(0,game.countdown-delta);return;}game.elapsed=Math.min(120000,game.elapsed+delta);game.stage=Math.min(3,Math.floor(game.elapsed/30000));if(game.cpu){while(game.elapsed>=game.botAt){C.award(game.bot,Math.random()<game.botProfile.accuracy,Math.random()<.4,game.botAt,mode);game.botAt+=game.botProfile.interval*(.8+Math.random()*.4);}}}
  function hud(){
    if(!game||screen!=='game')return;const remaining=Math.max(0,120000-game.elapsed-game.penalty),sec=Math.ceil(remaining/1000),fever=game.feverUntil>game.elapsed;
    $('#clock').textContent=`${Math.floor(sec/60)}:${String(sec%60).padStart(2,'0')}`;$('#clock').classList.toggle('danger',sec<=15);
    $('#score').textContent=C.fmt(game.score);$('#session-bar').style.width=remaining/1200+'%';$('#stage').textContent=`STAGE 0${game.stage+1} / 04`;
    $('#combo').textContent=`×${C.multiplier(game.combo)*(fever?2:1)}`;
    $('#chain strong').textContent=String(game.combo).padStart(2,'0');$('#chain em').textContent='×'+C.multiplier(game.combo)*(fever?2:1);$('#chain').classList.toggle('hot',game.combo>=5);
    $('#fever-label').textContent=fever?`FEVER ×2 / ${Math.ceil((game.feverUntil-game.elapsed)/1000)}s`:'FEVER';
    $('#fever-bar').style.width=(fever?(game.feverUntil-game.elapsed)/120:game.gauge)+'%';$('#game').classList.toggle('fever',fever);
    const bar=$('#q-bar');if(bar)bar.style.transform=`scaleX(${Math.max(0,1-(game.elapsed-game.qStart)/game.limit)})`;
    if(game.cpu){$('#bot-score').textContent=C.fmt(game.bot.score);const delta=game.score-game.bot.score;$('#lead').textContent=(delta>=0?'+':'')+C.fmt(delta);}
  }
  function tick(now){if(!game||screen!=='game')return;if(!game.paused){step(now);countdownDisplay();if(checkEnd())return;if(game.elapsed-game.qStart>=game.limit)timeout();if(screen!=='game')return;hud();game.effects.draw(now,profile.settings.reduced);}frame=requestAnimationFrame(tick);}
  function finish(aborted=false){
    if(!game||screen!=='game')return;cancelAnimationFrame(frame);screen='result';overlay.hidden=true;document.body.style.overflow='';
    const g=game,eligible=!g.practice&&!aborted,old=profile.records.filter(r=>r.mode===mode&&r.group===group&&r.cpu===g.cpu&&!r.practice&&!r.aborted),best=Math.max(0,...old.map(r=>r.score));
    const won=g.score>g.bot.score,draw=g.score===g.bot.score;
    let delta=0;if(g.cpu&&!g.practice){delta=aborted?-12:draw?0:won?24:-12;const previous=profile.ratings[mode];profile.ratings[mode]=Math.max(400,Math.min(5000,previous+delta));delta=profile.ratings[mode]-previous;}
    const xp=g.correct*10,oldXP=profile.xp;profile.xp+=xp;
    const record={at:Date.now(),mode,group,cpu:g.cpu,practice:g.practice,aborted,score:g.score,correct:g.correct,wrong:g.wrong,maxCombo:g.maxCombo};
    profile.records=C.retainRecords([record,...profile.records]);save();result={...g,record,xp,delta,best,newBest:eligible&&g.score>best,won,draw};
    const accuracy=g.correct+g.wrong?Math.round(g.correct/(g.correct+g.wrong)*100):0;
    app.innerHTML=`<div class="shell"><header class="topbar"><div class="wordmark">フラッシュ検査</div><button class="icon-btn" data-action="home" aria-label="メニューへ">${svg('close')}</button></header><div class="result-title"><div class="eyebrow">${names[mode]} / ${g.practice?'PRACTICE':g.cpu?'CPU MATCH':'SCORE ATTACK'}</div><h1>${aborted?'RETIRED.':g.cpu?won?'YOU WIN.':draw?'DRAW.':'REMATCH?':'TIME UP.'}</h1></div>
      <div class="result-score"><small>TOTAL SCORE</small>${result.newBest?'<span class="best-badge">↗ NEW BEST</span>':''}<strong>${C.fmt(g.score)}</strong><p>${g.cpu?`CPU ${C.fmt(g.bot.score)} / RATE ${profile.ratings[mode]} (${delta>=0?'+':''}${delta})`:`BEST ${C.fmt(Math.max(best,eligible?g.score:0))}`}　·　+${xp} XP</p></div>
      <div class="result-xp"><div><strong id="xp-level">LV.${1+Math.floor(oldXP/500)}</strong><b>+${xp} XP</b></div><div class="result-xp-track"><i id="xp-fill" style="width:${oldXP%500/5}%"></i></div><span id="xp-count">${oldXP%500} / 500</span></div><div class="stats-grid"><div class="stat"><strong>${g.correct}</strong><small>正解 / ${accuracy}%</small></div><div class="stat"><strong>${g.maxCombo}</strong><small>最大 COMBO</small></div><div class="stat"><strong>${g.fevers}</strong><small>FEVER</small></div></div>
      <div class="result-actions"><button class="primary" data-action="replay">もう一回 ↗</button><button class="quiet-button" data-action="review" ${g.errors.length?'':'disabled'}>ミスだけ再戦${g.errors.length?'':'（なし）'}</button></div><button class="quiet-button" style="width:100%;margin-top:10px" data-action="home">メニュー</button>
      ${g.practice?'<p class="small-note">練習記録：ランキング・レートの対象外</p>':''}${!storageOK?'<p class="storage-warning">保存できませんでした。設定から記録を書き出せます。</p>':''}
      <section class="review"><h2>振り返り <span class="eyebrow">${g.errors.length} MISSES</span></h2>${g.errors.length?g.errors.map(e=>{const d=LAB.find(d=>d.id===e.id);return `<div class="review-row"><strong>${d.short} ${d.sex}　${C.range(d)} ${d.unit}</strong><span>${d.name} / ${e.side?'入力 '+esc(e.response)+' → '+e.answer:C.fmt(e.value)+' '+d.unit+' → '+e.answer+'（'+(labels[e.response]||esc(e.response))+ '）'}</span></div>`;}).join(''):'<p class="empty">ミスなし</p>'}</section></div>`;
    game=null;animateXP(oldXP,xp);audio.tone(523,.2,.14,'triangle');audio.tone(784,.25,.1,'triangle',.1);
  }
  function animateXP(from,gain){
    cancelAnimationFrame(xpFrame);let started=performance.now(),lastLevel=Math.floor(from/500),lastTone=0;
    const reduced=profile.settings.reduced||matchMedia('(prefers-reduced-motion: reduce)').matches;
    function draw(now){
      if(screen!=='result'||!$('#xp-fill'))return;
      const t=reduced?1:Math.min(1,(now-started)/1500),xp=from+Math.floor(gain*(1-(1-t)**2)),level=Math.floor(xp/500);
      $('#xp-fill').style.width=xp%500/5+'%';$('#xp-level').textContent='LV.'+(level+1);$('#xp-count').textContent=xp%500+' / 500';
      if(level>lastLevel){$('#xp-level').classList.add('level-up');audio.jackpot();lastLevel=level;}
      else if(t<1&&gain&&now-lastTone>140){audio.tone(450+(xp%500),.045,.055,'triangle');lastTone=now;}
      if(t<1)xpFrame=requestAnimationFrame(draw);
    }
    xpFrame=requestAnimationFrame(draw);
  }
  function pause(){if(game&&!game.paused){step(performance.now());if(checkEnd())return false;game.paused=true;}return true;}
  function resume(){overlay.hidden=true;if(game){game.last=performance.now();game.paused=false;audio.unlock();}lastFocus?.focus?.();}
  function modal(title,body){lastFocus=document.activeElement;overlay.hidden=false;overlay.innerHTML=`<section class="modal" role="dialog" aria-modal="true" aria-label="${title}"><div class="modal-head"><h2>${title}</h2><button class="icon-btn" data-action="close" aria-label="閉じる">${svg('close')}</button></div>${body}</section>`;overlay.querySelector('button')?.focus();}
  function settings(){if(!pause())return;const s=profile.settings;modal(game?'PAUSE':'設定',`${['bgm','se'].map(k=>`<div class="setting"><div class="setting-line"><label for="${k}-volume">${k.toUpperCase()} <span id="${k}-pct">${Math.round(s[k+'Volume']*100)}%</span></label><button class="toggle ${s[k]?'on':''}" data-toggle="${k}" aria-pressed="${s[k]}">${s[k]?'ON':'OFF'}</button></div><input id="${k}-volume" type="range" min="0" max="100" value="${s[k+'Volume']*100}" data-volume="${k}" aria-label="${k.toUpperCase()}音量"></div>`).join('')}
      <div class="setting"><div class="setting-line"><label>演出控えめ</label><button class="toggle ${s.reduced?'on':''}" data-toggle="reduced" aria-pressed="${s.reduced}">${s.reduced?'ON':'OFF'}</button></div></div>
      <div class="modal-actions">${game?'<button class="primary" data-action="close">再開 ↗</button>':''}<button class="quiet-button" data-action="reference">基準値一覧${game?'（練習に切り替え）':''}</button>${game?'<button class="quiet-button danger-btn" data-action="quit">ゲームをやめる</button>':'<button class="quiet-button" data-action="export">記録を書き出す</button><button class="quiet-button" data-action="import">記録を読み込む</button><input type="file" id="import-file" class="file-input" accept="application/json,.json"><p class="small-note">記録はこのブラウザに保存。読み込みは現在の記録を置き換えます。</p>'}</div>`);}
  let referenceGroup='全項目';
  function reference(){if(!pause())return;if(game){game.practice=true;$('#game-type').textContent=names[mode]+' · 練習';}referenceGroup='全項目';modal('基準値一覧',`<input class="search" id="ref-search" placeholder="項目・略語で検索" aria-label="基準値を検索"><div class="reference-filters">${groups.map(g=>`<button data-ref-group="${g}" class="${g===referenceGroup?'active':''}">${g}</button>`).join('')}</div><div id="reference-list" class="reference-list"></div><p class="small-note">提供された教材の基準値を収録。FBSは70〜110 mg/dL。赤血球・血小板は万/μL、白血球は/μL表記。基準値は施設・測定法で異なります。</p>`);filterReference();}
  function filterReference(){const term=($('#ref-search')?.value||'').toLowerCase().normalize('NFKC');const ds=LAB.filter(d=>(referenceGroup==='全項目'||referenceGroup===d.group)&&[d.name,d.short,d.sex].join(' ').toLowerCase().normalize('NFKC').includes(term));$('#reference-list').innerHTML=ds.length?ds.map(d=>`<div class="reference-row"><div><strong>${d.short} ${d.sex}</strong><small>${d.name}</small></div><div class="reference-range">${C.range(d)}<small>${d.unit}</small></div></div>`).join(''):'<p class="empty">該当する項目がありません</p>';}
  function records(){modal('記録',`<div class="segmented">${Object.entries(names).map(([id,n])=>`<button data-record-mode="${id}" class="${mode===id?'active':''}">${n}</button>`).join('')}</div><div class="section-label" style="margin-top:22px"><span>PERSONAL TOP 10</span><span>全項目 / SOLO</span></div><div id="rankings"></div><div class="section-label" style="margin-top:24px"><span>RECENT PLAYS</span><span>最新20件</span></div><div id="recent"></div>`);renderRecords(mode);}
  function renderRecords(m){const all=profile.records.filter(r=>r.mode===m),top=all.filter(r=>r.group==='全項目'&&!r.cpu&&!r.practice&&!r.aborted).sort((a,b)=>b.score-a.score).slice(0,10);const row=(r,i)=>`<div class="record-row"><b>${i+1}</b><span>${new Date(r.at).toLocaleDateString('ja-JP',{month:'numeric',day:'numeric'})}<small>${r.group} / ${r.cpu?'CPU':'SOLO'}${r.practice?' / 練習':''}${r.aborted?' / 中断':''}<br>${r.correct}正解 · ${r.maxCombo} COMBO</small></span><strong>${C.fmt(r.score)}</strong></div>`;$('#rankings').innerHTML=top.length?top.map(row).join(''):'<p class="empty">記録なし</p>';$('#recent').innerHTML=all.length?all.slice(0,20).map(row).join(''):'<p class="empty">記録なし</p>';}
  function exportData(){const url=URL.createObjectURL(new Blob([JSON.stringify(profile,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='dopalab-records.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  document.addEventListener('click',e=>{
    const b=e.target.closest('button');if(!b||b.disabled)return;
    if(b.dataset.mode){mode=b.dataset.mode;start();return;}
    if(b.dataset.versus){cpu=b.dataset.versus==='true';home();return;}
    if(b.dataset.answer){answer(b.dataset.answer);return;}
    if(b.dataset.key){enterKey(b.dataset.key);return;}
    if(b.dataset.card!==undefined){pickCard(Number(b.dataset.card));return;}
    if(b.dataset.toggle){const k=b.dataset.toggle;profile.settings[k]=!profile.settings[k];save();motion();b.classList.toggle('on',profile.settings[k]);b.textContent=profile.settings[k]?'ON':'OFF';b.setAttribute('aria-pressed',profile.settings[k]);audio.unlock();return;}
    if(b.dataset.refGroup){referenceGroup=b.dataset.refGroup;overlay.querySelectorAll('[data-ref-group]').forEach(el=>el.classList.toggle('active',el.dataset.refGroup===referenceGroup));filterReference();return;}
    if(b.dataset.recordMode){overlay.querySelectorAll('[data-record-mode]').forEach(el=>el.classList.toggle('active',el===b));renderRecords(b.dataset.recordMode);return;}
    const actions={start:()=>start(),settings,reference,records,close:resume,home,replay:()=>start(result?.reviewIds),review:()=>{const ids=[...new Set(result.errors.map(e=>e.id))];start(ids);},quit:()=>finish(true),export:exportData,import:()=>$('#import-file').click()};actions[b.dataset.action]?.();
  });
  document.addEventListener('input',e=>{if(e.target.id==='ref-search')filterReference();if(e.target.dataset.volume){const k=e.target.dataset.volume;profile.settings[k+'Volume']=Number(e.target.value)/100;$('#'+k+'-pct').textContent=e.target.value+'%';save();}});
  document.addEventListener('change',async e=>{
    if(e.target.id==='group')group=e.target.value;
    if(e.target.id==='import-file'){
      const file=e.target.files[0];if(!file)return;
      try{if(file.size>1000000)throw Error();const p=JSON.parse(await file.text());if(!validProfile(p))throw Error();profile={version:1,xp:p.xp,ratings:{...p.ratings},settings:{...p.settings},records:p.records};save();motion();home();toast('記録を読み込みました');}catch{toast('読み込めません。DOPA LABの記録JSONを選んでください。');}
    }
  });
  document.addEventListener('keydown',e=>{
    if(!overlay.hidden){if(e.key==='Escape'){e.preventDefault();resume();}if(e.key==='Tab'){const items=[...overlay.querySelectorAll('button,input,select')].filter(x=>!x.disabled&&x.offsetParent!==null);const first=items[0],last=items.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}}return;}
    if(screen!=='game'||e.repeat)return;
    if(e.key==='Escape'){settings();return;}
    if(mode==='sort'){const v={ArrowLeft:'low',ArrowDown:'normal',ArrowRight:'high'}[e.key];if(v){e.preventDefault();answer(v);}}
    if(mode==='fill'&&(/^[0-9.]$/.test(e.key)||['Backspace','Enter','Delete'].includes(e.key))){e.preventDefault();enterKey(({Backspace:'erase',Enter:'enter',Delete:'clear'})[e.key]||e.key);}
    if(mode==='hunt'&&/^[1-4]$/.test(e.key)){e.preventDefault();pickCard(Number(e.key)-1);}
  });
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&game&&!game.paused)settings();});
  home();
})();

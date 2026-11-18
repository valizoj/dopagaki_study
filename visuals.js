(function(root){
  const C=root.GameCore;
  function sexBadge(sex){return sex?`<span class="sex-tag ${sex==='男性'?'male':'female'}"><b aria-hidden="true">${sex==='男性'?'♂':'♀'}</b>${sex}</span>`:'';}
  function numberLine(q,marker=false){
    const d=q.d,g=C.numberLine(d,q.value),id='hatch-'+q.uid;
    const tick=x=>`<path d="M${x} 16V31"/>`,label=(x,v)=>`<b style="left:${x/3.2}%">${C.fmt(v)}</b>`;
    return `<div class="number-line-wrap" role="img" aria-label="基準範囲 ${C.range(d)} ${d.unit}${marker?'、今回 '+C.fmt(q.value):''}"><div class="axis-labels" aria-hidden="true">${d.lo!==null?label(g.lo,d.lo):''}${d.hi!==null?label(g.hi,d.hi):''}</div><svg class="number-line" viewBox="0 14 320 38" preserveAspectRatio="none" aria-hidden="true"><defs><pattern id="${id}" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(30)"><path d="M0 0V6" stroke="currentColor" stroke-width="2"/></pattern></defs><rect class="range-fill" x="${g.lo}" y="18" width="${g.hi-g.lo}" height="11"/><rect class="range-hatch" x="${g.lo}" y="18" width="${g.hi-g.lo}" height="11" fill="url(#${id})"/><path class="axis" d="M8 30H312m-5-4 5 4-5 4"/>${d.lo!==null?tick(g.lo):`<path class="open-range" d="M24 18 15 23.5 24 29"/>`}${d.hi!==null?tick(g.hi):'<path class="open-range" d="m296 18 9 5.5-9 5.5"/>'}${marker?`<path class="value-arrow" d="M${g.value} 49V38m-5 3 5-7 5 7Z"/>`:''}</svg></div>`;
  }
  class Effects {
    constructor(canvas){this.canvas=canvas;this.ctx=canvas.getContext('2d');this.particles=[];this.rings=[];this.last=0;this.dirty=false;}
    burst(combo,fever,reduced){
      if(reduced||!this.ctx)return;
      const width=this.canvas.clientWidth,height=this.canvas.clientHeight,dpr=Math.min(devicePixelRatio||1,1.5);
      if(this.canvas.width!==Math.round(width*dpr)||this.canvas.height!==Math.round(height*dpr)){this.canvas.width=Math.round(width*dpr);this.canvas.height=Math.round(height*dpr);this.ctx.setTransform(dpr,0,0,dpr,0,0);}
      const big=combo%5===0||fever,colors=fever?['#ffe781','#ffb83e','#fff7d0','#ff75cf']:['#fff1a3','#6ceaff','#e3ff67','#ff9edc'];
      const count=big?38:16;
      for(let i=0;i<count;i++){
        const side=i%2,x=side?width-12:12,y=height*.48,angle=(side?Math.PI:0)+(Math.random()-.5)*2.2,speed=90+Math.random()*300;
        this.particles.push({x,y,vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed-60,life:.38+Math.random()*.32,max:.7,size:2+Math.random()*3,color:colors[i%colors.length],star:i%3===0});
      }
      this.particles=this.particles.slice(-100);
      if(big)this.rings.push({x:width/2,y:height*.48,life:.5,r:45,color:fever?'#ffe57e':'#7ceaff'});
      this.rings=this.rings.slice(-3);this.dirty=true;
    }
    draw(now,reduced=false){
      const dt=Math.min(.04,(now-(this.last||now))/1000);this.last=now;
      if(!this.dirty)return;
      const c=this.ctx;c.clearRect(0,0,this.canvas.clientWidth,this.canvas.clientHeight);
      if(reduced){this.particles=[];this.rings=[];this.dirty=false;return;}
      for(const p of this.particles){p.life-=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=280*dt;c.globalAlpha=Math.max(0,p.life/p.max);c.fillStyle=p.color;
        if(p.star){c.beginPath();c.moveTo(p.x-p.size*2,p.y);c.lineTo(p.x,p.y-p.size*.65);c.lineTo(p.x+p.size*2,p.y);c.lineTo(p.x,p.y+p.size*.65);c.fill();c.beginPath();c.moveTo(p.x,p.y-p.size*2);c.lineTo(p.x+p.size*.65,p.y);c.lineTo(p.x,p.y+p.size*2);c.lineTo(p.x-p.size*.65,p.y);c.fill();}
        else c.fillRect(p.x,p.y,p.size,p.size*1.8);
      }
      for(const r of this.rings){r.life-=dt;r.r+=330*dt;c.globalAlpha=Math.max(0,r.life);c.strokeStyle=r.color;c.lineWidth=3;c.beginPath();c.arc(r.x,r.y,r.r,0,Math.PI*2);c.stroke();}
      c.globalAlpha=1;this.particles=this.particles.filter(p=>p.life>0);this.rings=this.rings.filter(r=>r.life>0);
      if(!this.particles.length&&!this.rings.length){c.clearRect(0,0,this.canvas.clientWidth,this.canvas.clientHeight);this.dirty=false;}
    }
  }
  root.LabUI={sexBadge,numberLine,Effects};
})(globalThis);

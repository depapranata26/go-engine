// js/app.js — UI Go Engine (butuh GoCore global)
(function(){
"use strict";
const G = GoCore;
const KOMI = 6.5;
const $ = id => document.getElementById(id);

/* ================= Tabs ================= */
const tabs = [["t-play","p-play"],["t-analyze","p-analyze"],["t-tutor","p-tutor"]];
tabs.forEach(([b,p])=>{
  $(b).addEventListener("click",()=>{
    tabs.forEach(([b2,p2])=>{ $(b2).classList.toggle("on",b2===b); $(p2).classList.toggle("on",p2===p); });
    if(p==="p-play") play.board.resize();
    if(p==="p-analyze") an.board.resize();
  });
});

/* ================= Papan (canvas) ================= */
function hoshi(N){
  if(N===9) return [[2,2],[2,6],[6,2],[6,6],[4,4]];
  if(N===13) return [[3,3],[3,9],[9,3],[9,9],[3,6],[6,3],[6,9],[9,6],[6,6]];
  const p=[3,9,15], out=[];
  for(const y of p) for(const x of p) out.push([x,y]);
  return out;
}

class Board{
  constructor(canvas){
    this.cv=canvas; this.ctx=canvas.getContext("2d");
    this.N=9; this.grid=G.newGrid(9);
    this.lastMove=null; this.markers=[]; this.ghost=null;
    this.showAtari=true; this.onTap=null;
    canvas.addEventListener("click",e=>this._tap(e));
    window.addEventListener("resize",()=>this.render());
  }
  resize(){ this.render(); }
  setSize(N){ this.N=N; this.grid=G.newGrid(N); this.lastMove=null; this.markers=[]; this.render(); }
  _tap(e){
    const r=this.cv.getBoundingClientRect();
    const dpr=window.devicePixelRatio||1;
    const px=(e.clientX-r.left)*dpr, py=(e.clientY-r.top)*dpr;
    const S=this.cv.width; if(!S)return;
    const pad=S*0.075, cell=(S-2*pad)/(this.N-1);
    const x=Math.round((px-pad)/cell), y=Math.round((py-pad)/cell);
    if(x<0||y<0||x>=this.N||y>=this.N)return;
    if(Math.abs(px-(pad+x*cell))>cell*0.45||Math.abs(py-(pad+y*cell))>cell*0.45)return;
    if(this.onTap)this.onTap(y*this.N+x);
  }
  render(){
    const cv=this.cv, ctx=this.ctx;
    const cssW=cv.clientWidth; if(!cssW)return;
    const dpr=window.devicePixelRatio||1;
    const S=Math.round(cssW*dpr);
    if(cv.width!==S){cv.width=S;cv.height=S;}
    const N=this.N, W=S, pad=S*0.075, cell=(W-2*pad)/(N-1);
    const X=i=>pad+(i%N)*cell, Y=i=>pad+(((i/N)|0))*cell;
    ctx.fillStyle="#dcb35c"; ctx.fillRect(0,0,W,W);
    ctx.strokeStyle="#3a2a18"; ctx.lineWidth=Math.max(1,S/500);
    ctx.beginPath();
    for(let k=0;k<N;k++){
      ctx.moveTo(pad,pad+k*cell); ctx.lineTo(W-pad,pad+k*cell);
      ctx.moveTo(pad+k*cell,pad); ctx.lineTo(pad+k*cell,W-pad);
    }
    ctx.stroke();
    ctx.fillStyle="#3a2a18";
    for(const [hx,hy] of hoshi(N)){
      ctx.beginPath(); ctx.arc(pad+hx*cell,pad+hy*cell,Math.max(2,S/130),0,7); ctx.fill();
    }
    ctx.fillStyle="#5a4a30";
    ctx.font=`${Math.max(9,S/44)}px system-ui`; ctx.textAlign="center"; ctx.textBaseline="middle";
    const L="ABCDEFGHJKLMNOPQRSTUVWXYZ";
    for(let k=0;k<N;k++){
      ctx.fillText(L[k],pad+k*cell,pad*0.42);
      ctx.fillText(String(N-k),pad*0.42,pad+k*cell);
    }
    // cincin atari
    if(this.showAtari){
      const seen=new Set();
      for(let i=0;i<N*N;i++){
        const c=this.grid[i];
        if(!c||seen.has(i))continue;
        const grp=G.getGroup(this.grid,N,i);
        grp.stones.forEach(s=>seen.add(s));
        if(grp.libs.size===1){
          ctx.strokeStyle="rgba(200,30,30,.9)"; ctx.lineWidth=Math.max(2,S/220);
          for(const s of grp.stones){ ctx.beginPath(); ctx.arc(X(s),Y(s),cell*0.42,0,7); ctx.stroke(); }
        }
      }
    }
    // batu
    for(let i=0;i<N*N;i++){
      const c=this.grid[i]; if(!c)continue;
      const x=X(i),y=Y(i),r=cell*0.46;
      const gr=ctx.createRadialGradient(x-r*0.35,y-r*0.35,r*0.1,x,y,r);
      if(c===1){gr.addColorStop(0,"#565656");gr.addColorStop(1,"#050505");}
      else{gr.addColorStop(0,"#ffffff");gr.addColorStop(1,"#c4c4c4");}
      ctx.fillStyle=gr; ctx.beginPath(); ctx.arc(x,y,r,0,7); ctx.fill();
      if(c===2){ctx.strokeStyle="#8f8f8f";ctx.lineWidth=1;ctx.stroke();}
    }
    if(this.lastMove!==null&&this.lastMove>=0){
      ctx.fillStyle="#c1121f";
      ctx.beginPath(); ctx.arc(X(this.lastMove),Y(this.lastMove),Math.max(2,S/120),0,7); ctx.fill();
    }
    if(this.ghost&&this.grid[this.ghost.i]===0){
      ctx.globalAlpha=0.4;
      ctx.fillStyle=this.ghost.color===1?"#000":"#fff";
      ctx.beginPath(); ctx.arc(X(this.ghost.i),Y(this.ghost.i),cell*0.46,0,7); ctx.fill();
      ctx.globalAlpha=1;
    }
    const cols=["#f59e0b","#94a3b8","#cd7f32"];
    this.markers.forEach((m,k)=>{
      if(m.i<0)return;
      ctx.fillStyle=cols[k%3]; ctx.strokeStyle="#1a1a1a"; ctx.lineWidth=2;
      ctx.beginPath(); ctx.arc(X(m.i),Y(m.i),cell*0.34,0,7); ctx.fill(); ctx.stroke();
      ctx.fillStyle="#1a1a1a"; ctx.font=`bold ${Math.max(10,S/34)}px system-ui`;
      ctx.fillText(String(k+1),X(m.i),Y(m.i)+1);
    });
  }
}

/* ================= Worker ================= */
const worker=new Worker("js/worker.js");
let pending=null; // {kind:'play'|'analyze'}
worker.onmessage=e=>{
  const m=e.data;
  if(m.type==="progress"&&pending){
    if(pending.kind==="analyze"){
      $("an-prog").style.display="";
      $("an-prog").firstElementChild.style.width=Math.round(m.p*100)+"%";
    }
    return;
  }
  if(m.type==="result"&&pending){
    if(pending.kind==="play") onAiResult(m);
    else onAnalyzeResult(m);
    pending=null; return;
  }
  if(m.type==="error"){ playMsg("Engine error: "+m.message); pending=null; }
};

function levelOpts(N,lv){
  const t={
    9:[{maxCands:24,perMove:12},{maxCands:36,perMove:30},{maxCands:48,perMove:60}],
    13:[{maxCands:20,perMove:8},{maxCands:28,perMove:16},{maxCands:36,perMove:30}],
    19:[{maxCands:16,perMove:6},{maxCands:24,perMove:10},{maxCands:32,perMove:16}]
  }[N];
  return t[lv];
}

/* ================= Mode MAIN ================= */
const play={
  board:new Board($("board-play")),
  N:9, grid:G.newGrid(9), toMove:1, ko:null, hist:[],
  capB:0, capW:0, passes:0, over:false,
  aiColor:2, level:0, aiBusy:false
};
function playMsg(t){ $("play-msg").textContent=t; }
function fmtLead(){
  const s=G.scoreTT(play.grid,play.N);
  const d=s.black-(s.white+KOMI);
  const r=v=>{const x=Math.round(v*10)/10;return Number.isInteger(x)?x:x.toFixed(1);};
  return d>=0?`H +${r(d)}`:`P +${r(-d)}`;
}
function playRender(){
  play.board.N=play.N; play.board.grid=play.grid; play.board.render();
  $("play-turn").textContent=play.toMove===1?"Hitam":"Putih";
  $("play-capb").textContent=play.capB;
  $("play-capw").textContent=play.capW;
  $("play-score").textContent=fmtLead();
}
function playSnap(){
  play.hist.push({grid:Int8Array.from(play.grid),ko:play.ko,toMove:play.toMove,
    capB:play.capB,capW:play.capW,passes:play.passes,last:play.board.lastMove});
}
function playRestore(h){
  play.grid=h.grid; play.ko=h.ko; play.toMove=h.toMove;
  play.capB=h.capB; play.capW=h.capW; play.passes=h.passes;
  play.board.lastMove=h.last; play.over=false;
}
function doMove(i){
  if(play.over||play.aiBusy)return;
  const r=G.playMove(play.grid,play.N,play.toMove,i,play.ko);
  if(!r){ playMsg("Langkah ilegal — coba titik lain."); return false; }
  playSnap();
  play.grid=r.grid; play.ko=r.ko;
  if(play.toMove===1)play.capB+=r.captured.length; else play.capW+=r.captured.length;
  play.board.lastMove=i; play.passes=0; play.toMove=3-play.toMove;
  playRender();
  if(play.toMove===play.aiColor) aiTurn();
  else playMsg(play.toMove===1?"Giliran Hitam.":"Giliran Putih.");
  return true;
}
function doPass(){
  if(play.over||play.aiBusy)return;
  playSnap();
  play.passes++; play.board.lastMove=null; play.toMove=3-play.toMove;
  if(play.passes>=2){ finishGame(); return; }
  playRender(); playMsg("Lewat. "+(play.toMove===1?"Giliran Hitam.":"Giliran Putih."));
  if(play.toMove===play.aiColor) aiTurn();
}
function aiTurn(){
  play.aiBusy=true; playMsg("🤖 AI mikir…");
  pending={kind:"play"};
  worker.postMessage({type:"genmove",grid:Array.from(play.grid),N:play.N,
    color:play.aiColor,ko:play.ko,komi:KOMI,opts:levelOpts(play.N,play.level)});
}
function onAiResult(m){
  play.aiBusy=false;
  const mv=m.moves[0];
  if(!mv||mv.pass){ doPass(); return; }
  // AI tidak pakai doMove (giliran sudah benar)
  const r=G.playMove(play.grid,play.N,play.aiColor,mv.i,play.ko);
  if(!r){ playMsg("AI bingung, lewat."); doPass(); return; }
  playSnap();
  play.grid=r.grid; play.ko=r.ko;
  if(play.aiColor===1)play.capB+=r.captured.length; else play.capW+=r.captured.length;
  play.board.lastMove=mv.i; play.passes=0; play.toMove=3-play.aiColor;
  playRender();
  playMsg(`AI main di ${mv.name} (yakin ${(mv.winrate*100).toFixed(0)}%). Giliranmu.`);
}
function finishGame(){
  play.over=true;
  const s=G.scoreTT(play.grid,play.N);
  const b=s.black, w=s.white+KOMI, d=b-w;
  const r=v=>{const x=Math.round(v*10)/10;return Number.isInteger(x)?x:x.toFixed(1);};
  playMsg(d>0?`🏁 Selesai! Hitam menang ${r(d)} poin (H ${r(b)} – P ${r(w)}).`
           :d<0?`🏁 Selesai! Putih menang ${r(-d)} poin (H ${r(b)} – P ${r(w)}).`
           :`🏁 Seri! (H ${r(b)} – P ${r(w)})`);
  playRender();
}
play.board.onTap=i=>{ if(!play.over&&!play.aiBusy&&play.toMove!==play.aiColor) doMove(i); };
$("play-pass").addEventListener("click",doPass);
$("play-undo").addEventListener("click",()=>{
  if(play.aiBusy||!play.hist.length)return;
  playRestore(play.hist.pop());
  if(play.toMove===play.aiColor&&play.hist.length) playRestore(play.hist.pop());
  playRender(); playMsg("Dibatalkan. Giliranmu lagi.");
});
$("play-resign").addEventListener("click",()=>{
  if(play.over)return;
  play.over=true;
  const humanWon=false;
  playMsg(play.toMove===play.aiColor?"🏳 AI menyerah. Kamu menang!":"🏳 Kamu menyerah. AI menang. Main lagi?");
});
function playNew(){
  play.N=parseInt($("play-size").value,10);
  play.level=parseInt($("play-level").value,10);
  const hc=parseInt($("play-color").value,10);
  play.aiColor=3-hc;
  play.grid=G.newGrid(play.N); play.toMove=1; play.ko=null; play.hist=[];
  play.capB=0; play.capW=0; play.passes=0; play.over=false; play.aiBusy=false;
  play.board.setSize(play.N); play.board.lastMove=null;
  const nm={9:"9×9",13:"13×13",19:"19×19"}[play.N];
  $("play-note").textContent=`Papan ${nm}. `+(play.N===19?"AI di 19×19 butuh belasan detik mikir di level Kuat.":"AI mikir beberapa detik.");
  playRender(); playMsg("Hitam jalan dulu. Ketuk titik perpotongan untuk menaruh batu.");
  if(play.aiColor===1) aiTurn();
}
$("play-new").addEventListener("click",playNew);
$("play-size").addEventListener("change",playNew);
$("play-level").addEventListener("change",()=>{play.level=parseInt($("play-level").value,10);});
$("play-color").addEventListener("change",playNew);

/* ================= Mode ANALISIS ================= */
const an={
  board:new Board($("board-an")),
  N:9, grid:G.newGrid(9), toMove:1, tool:1
};
an.board.onTap=i=>{
  if(an.tool==="e") an.grid[i]=0;
  else an.grid[i]=an.tool;
  an.board.markers=[]; $("an-result").style.display="none";
  an.board.render();
};
function anTool(t){
  an.tool=t;
  $("tool-b").classList.toggle("on",t===1);
  $("tool-w").classList.toggle("on",t===2);
  $("tool-e").classList.toggle("on",t==="e");
}
$("tool-b").addEventListener("click",()=>anTool(1));
$("tool-w").addEventListener("click",()=>anTool(2));
$("tool-e").addEventListener("click",()=>anTool("e"));
$("an-clear").addEventListener("click",()=>{
  an.grid=G.newGrid(an.N); an.board.markers=[];
  $("an-result").style.display="none"; an.board.render();
});
$("an-size").addEventListener("change",()=>{
  an.N=parseInt($("an-size").value,10);
  an.board.setSize(an.N); an.grid=an.board.grid;
  $("an-result").style.display="none";
});
$("an-turn").addEventListener("change",()=>{ an.toMove=parseInt($("an-turn").value,10); });
$("an-go").addEventListener("click",()=>{
  an.toMove=parseInt($("an-turn").value,10);
  $("an-msg").textContent="⏳ Menganalisis…";
  $("an-prog").style.display=""; $("an-prog").firstElementChild.style.width="0";
  $("an-go").disabled=true;
  pending={kind:"analyze"};
  const lv=an.N===9?{maxCands:36,perMove:30}:an.N===13?{maxCands:28,perMove:16}:{maxCands:24,perMove:10};
  worker.postMessage({type:"analyze",grid:Array.from(an.grid),N:an.N,
    color:an.toMove,ko:null,komi:KOMI,opts:lv});
});
function onAnalyzeResult(m){
  $("an-go").disabled=false;
  $("an-prog").style.display="none";
  $("an-result").style.display="";
  const wb=m.winrateBlack*100;
  $("an-evalbar").style.setProperty("--w",wb.toFixed(1)+"%");
  $("an-wb").textContent="⚫ "+wb.toFixed(0)+"%";
  $("an-ww").textContent="⚪ "+(100-wb).toFixed(0)+"%";
  $("an-for").textContent=an.toMove===1?"Hitam":"Putih";
  $("an-ms").textContent="dihitung dalam "+(m.ms/1000).toFixed(1)+" dtk";
  const s=G.scoreTT(an.grid,an.N);
  const d=s.black-(s.white+KOMI);
  const r=v=>{const x=Math.round(v*10)/10;return Number.isInteger(x)?x:x.toFixed(1);};
  $("an-score").textContent=d>=0?`Hitam +${r(d)}`:`Putih +${r(-d)}`;
  const ul=$("an-moves"); ul.innerHTML="";
  an.board.markers=[];
  m.moves.forEach((mv,k)=>{
    an.board.markers.push({i:mv.i});
    const li=document.createElement("li");
    li.innerHTML=`<span><span class="mk">${k+1}</span><b>${mv.name}</b></span>
      <span class="wr">${(mv.winrate*100).toFixed(0)}%</span>`;
    ul.appendChild(li);
  });
  an.board.render();
  const best=m.moves[0];
  $("an-msg").textContent=best.pass
    ? "Engine menyarankan PASS — posisi sudah selesai."
    : `Saran terbaik: ${best.name} (${(best.winrate*100).toFixed(0)}% winrate).`;
}

/* ================= Init ================= */
playNew();
an.board.resize();
})();

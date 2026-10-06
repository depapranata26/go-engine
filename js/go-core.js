// js/go-core.js — Aturan Go + skoring + Monte Carlo.
// Jalan di Node (test) maupun browser/worker (tanpa API browser).
"use strict";

const GoCore = (function(){
  const EMPTY=0, BLACK=1, WHITE=2;

  // cache daftar tetangga per ukuran papan
  const neighCache={};
  function neigh(i,N){
    const key=N+":"+i;
    let r=neighCache[key];
    if(r) return r;
    const x=i%N, y=(i/N)|0;
    r=[];
    if(x>0)r.push(i-1);
    if(x<N-1)r.push(i+1);
    if(y>0)r.push(i-N);
    if(y<N-1)r.push(i+N);
    neighCache[key]=r;
    return r;
  }

  function newGrid(N){ return new Int8Array(N*N); }

  // flood fill: kembalikan {stones, libs}
  function getGroup(grid,N,start){
    const color=grid[start];
    const stones=[]; const libs=new Set(); const seen=new Set([start]);
    const stack=[start];
    while(stack.length){
      const i=stack.pop(); stones.push(i);
      const nb=neigh(i,N);
      for(let k=0;k<nb.length;k++){
        const j=nb[k], c=grid[j];
        if(c===EMPTY) libs.add(j);
        else if(c===color && !seen.has(j)){ seen.add(j); stack.push(j); }
      }
    }
    return {stones, libs};
  }

  // Coba langkah. Return {grid, captured, ko} atau null jika ilegal.
  // ko = titik ko aktif (atau null).
  function playMove(grid,N,color,i,ko){
    if(grid[i]!==EMPTY) return null;
    if(ko!==null && ko!==undefined && i===ko) return null;
    const g=Int8Array.from(grid);
    const enemy=3-color;
    g[i]=color;
    let captured=null;
    const checked=new Set();
    const nb=neigh(i,N);
    for(let k=0;k<nb.length;k++){
      const j=nb[k];
      if(g[j]===enemy && !checked.has(j)){
        const grp=getGroup(g,N,j);
        for(const s of grp.stones) checked.add(s);
        if(grp.libs.size===0){
          if(!captured)captured=[];
          for(const s of grp.stones){ captured.push(s); g[s]=EMPTY; }
        }
      }
    }
    const self=getGroup(g,N,i);
    if(self.libs.size===0) return null; // bunuh diri: ilegal
    let newKo=null;
    if(captured && captured.length===1 && self.stones.length===1 && self.libs.size===1){
      newKo=captured[0];
    }
    return {grid:g, captured:captured||[], ko:newKo};
  }

  function legalMoves(grid,N,color,ko){
    const out=[];
    for(let i=0;i<N*N;i++){
      if(grid[i]!==EMPTY) continue;
      if(ko!==null&&ko!==undefined&&i===ko) continue;
      if(playMove(grid,N,color,i,ko)) out.push(i);
    }
    return out;
  }

  // Skoring area ala Tromp-Taylor: batu + wilayah.
  // Return {black, white} TANPA komi.
  function scoreTT(grid,N){
    let bs=0, ws=0, bt=0, wt=0;
    const seen=new Uint8Array(N*N);
    for(let i=0;i<N*N;i++){
      const c=grid[i];
      if(c===BLACK){bs++;continue;}
      if(c===WHITE){ws++;continue;}
      if(seen[i])continue;
      let borders=0, size=0; // bitmask: 1=hitam, 2=putih
      const stack=[i]; seen[i]=1;
      while(stack.length){
        const j=stack.pop(); size++;
        const nb=neigh(j,N);
        for(let k=0;k<nb.length;k++){
          const m=nb[k], mc=grid[m];
          if(mc===EMPTY){ if(!seen[m]){seen[m]=1;stack.push(m);} }
          else if(mc===BLACK) borders|=1; else borders|=2;
        }
      }
      if(borders===1)bt+=size; else if(borders===2)wt+=size;
    }
    return {black:bs+bt, white:ws+wt};
  }

  // Satu playout acak sampai pass-pass. Return selisih (hitam - (putih+komi)).
  function shuffleInPlace(a,rng){
    for(let k=a.length-1;k>0;k--){const j=(rng()*(k+1))|0;const t=a[k];a[k]=a[j];a[j]=t;}
  }

  // Taktik ringan & aman: hanya CAPTURE grup musuh yang atari di dekat
  // langkah terakhir. Tanpa defend-buta (bisa nambah batu ke grup mati)
  // dan TANPA fallback scan (terbukti bikin bloodbath 900+ langkah).
  function captureNear(grid,N,color,ko,rng,lastMove){
    if(lastMove===null||lastMove===undefined)return null;
    const nb=neigh(lastMove,N);
    const seen=new Set(), libs=[];
    for(let k=0;k<nb.length;k++){
      const j=nb[k];
      if(grid[j]===EMPTY||grid[j]===color||seen.has(j))continue;
      const grp=getGroup(grid,N,j);
      for(const st of grp.stones)seen.add(st);
      if(grp.libs.size===1)libs.push(grp.libs.values().next().value);
    }
    shuffleInPlace(libs,rng);
    for(const lib of libs){
      if(lib===ko||grid[lib]!==EMPTY)continue;
      if(playMove(grid,N,color,lib,ko))return lib;
    }
    return null;
  }

  // Satu langkah playout: capture taktis bila ada, lalu acak murni.
  // Return null (pass) bila 24x gagal — JANGAN fallback scan.
  function playoutMove(grid,N,color,ko,rng,lastMove){
    if(rng()<0.85){
      const c=captureNear(grid,N,color,ko,rng,lastMove);
      if(c!==null)return c;
    }
    for(let t=0;t<24;t++){
      const i=(rng()*N*N)|0;
      if(grid[i]!==EMPTY)continue;
      if(ko!==null&&ko!==undefined&&i===ko)continue;
      if(playMove(grid,N,color,i,ko))return i;
    }
    return null;
  }

  function playout(grid,N,toMove,komi,rng,maxMoves){
    let g=Int8Array.from(grid);
    let color=toMove, ko=null, passes=0, moves=0, lastMove=null;
    const limit=maxMoves||N*N*3;
    let guard=0;
    while(passes<2 && moves<limit && guard<limit*4){
      guard++;
      const mv=playoutMove(g,N,color,ko,rng,lastMove);
      if(mv===null){ passes++; color=3-color; continue; }
      const r=playMove(g,N,color,mv,ko);
      if(!r){ passes++; color=3-color; continue; }
      g=r.grid; ko=r.ko; lastMove=mv; passes=0; color=3-color; moves++;
    }
    const s=scoreTT(g,N);
    return s.black-(s.white+komi);
  }

  // Peluang hitam menang dari posisi (toMove jalan). 0..1
  function evaluate(grid,N,toMove,komi,n,rng){
    let wins=0;
    for(let k=0;k<n;k++) if(playout(grid,N,toMove,komi,rng)>0) wins++;
    return wins/n;
  }

  function candidateMoves(grid,N,color,ko,maxCands){
    const all=legalMoves(grid,N,color,ko);
    if(all.length<=maxCands) return all;
    const scored=all.map(i=>{
      const nb=neigh(i,N);
      let near=0;
      for(let k=0;k<nb.length;k++) if(grid[nb[k]]!==EMPTY) near++;
      return {i, s: near*10 + Math.random()};
    });
    scored.sort((a,b)=>b.s-a.s);
    return scored.slice(0,maxCands).map(o=>o.i);
  }

  // 3 saran terbaik untuk `color`: [{i, pass, winrate, lead}]
  function suggest(grid,N,color,ko,komi,opts,rng,progress){
    opts=opts||{};
    const maxCands=opts.maxCands||40;
    const perMove=opts.perMove||24;
    const cands=candidateMoves(grid,N,color,ko,maxCands);
    const res=[];
    for(let c=0;c<cands.length;c++){
      const i=cands[c];
      const r=playMove(grid,N,color,i,ko);
      if(!r) continue;
      const wrBlack=evaluate(r.grid,N,3-color,komi,perMove,rng);
      const wr = color===BLACK ? wrBlack : 1-wrBlack;
      const s=scoreTT(r.grid,N);
      const lead = color===BLACK ? (s.black-(s.white+komi)) : ((s.white+komi)-s.black);
      res.push({i, winrate:wr, lead});
      if(progress) progress((c+1)/cands.length);
    }
    const wrPassBlack=evaluate(grid,N,3-color,komi,Math.max(8,perMove>>1),rng);
    res.push({i:-1, pass:true, winrate: color===BLACK?wrPassBlack:1-wrPassBlack, lead:0});
    res.sort((a,b)=>b.winrate-a.winrate);
    return res.slice(0,3);
  }

  // Nama koordinat ala Go: A1.. (tanpa huruf I), baris dari bawah.
  function coordName(i,N){
    const x=i%N, y=(i/N)|0;
    return "ABCDEFGHJKLMNOPQRSTUVWXYZ"[x]+(N-y);
  }

  return {EMPTY,BLACK,WHITE,newGrid,playMove,legalMoves,scoreTT,
          playout,evaluate,suggest,coordName,neigh,getGroup,
          _playoutMove:playoutMove};
})();

if(typeof module!=="undefined"&&module.exports) module.exports=GoCore;

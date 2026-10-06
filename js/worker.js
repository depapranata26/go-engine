// js/worker.js — Engine Go di background (tidak blokir UI).
importScripts('go-core.js');

let _s = 987654321;
function rng(){ _s=(_s*1103515245+12345)&0x7fffffff; return _s/0x7fffffff; }

function countStones(grid){
  let n=0;
  for(let i=0;i<grid.length;i++) if(grid[i]!==0)n++;
  return n;
}

onmessage = function(e){
  const m = e.data;
  if(m.type!=='analyze' && m.type!=='genmove') return;
  const t0 = Date.now();
  try{
    const grid = Int8Array.from(m.grid);
    const N = m.N, color = m.color;
    const ko = (m.ko===undefined||m.ko===null) ? null : m.ko;

    // Papan (hampir) kosong: saran bukaan standar, instan.
    if(countStones(grid) < 2){
      const c = (N/2)|0, p = N>=13?3:2;
      const pts = [[p,p],[N-1-p,p],[p,N-1-p],[N-1-p,N-1-p],[c,c]]
        .map(([x,y])=>y*N+x)
        .filter(i=>grid[i]===0);
      const moves = pts.slice(0,3).map((i,k)=>({i, pass:false, winrate:0.5, lead:0,
        name:GoCore.coordName(i,N)}));
      postMessage({type:'result', req:m.type, moves,
        winrateBlack: color===1?0.5:0.5, ms:Date.now()-t0, opening:true});
      return;
    }

    const sugg = GoCore.suggest(grid, N, color, ko, m.komi, m.opts, rng,
      p=>postMessage({type:'progress', p}));
    const best = sugg[0];
    postMessage({type:'result', req:m.type,
      moves: sugg.map(x=>({i:x.i, pass:!!x.pass, winrate:x.winrate, lead:x.lead,
        name: x.i>=0 ? GoCore.coordName(x.i,N) : 'pass'})),
      winrateBlack: color===1 ? best.winrate : 1-best.winrate,
      ms: Date.now()-t0});
  }catch(err){
    postMessage({type:'error', message:String(err&&err.message||err)});
  }
};

// Test aturan Go — jalankan: node test-core.js
const G = require('./js/go-core.js');
const {EMPTY:E, BLACK:B, WHITE:W} = G;
let pass=0, fail=0;
function ok(cond, name){ if(cond){pass++;} else {fail++; console.log("GAGAL:", name);} }
function mk(N, stones){ // stones: [[x,y,color],...]
  const g=G.newGrid(N);
  for(const [x,y,c] of stones) g[y*N+x]=c;
  return g;
}

// 1. Capture 1 batu
{
  // Putih (2,2) dikepung, hitam main (2,3) = indeks 2+3*5
  const g=mk(5,[[2,2,W],[1,2,B],[3,2,B],[2,1,B]]);
  const r=G.playMove(g,5,B,2+3*5,null);
  ok(r!==null, "capture: langkah legal");
  ok(r.grid[2+3*5]===B, "capture: batu hitam terpasang");
  ok(r.grid[2+2*5]===E, "capture: batu putih hilang");
  ok(r.captured.length===1, "capture: 1 tawanan");
}

// 2. Bunuh diri ilegal
{
  const g=mk(5,[[1,2,W],[3,2,W],[2,1,W],[2,3,W]]);
  const r=G.playMove(g,5,B,2+2*5,null);
  ok(r===null, "bunuh diri ditolak");
}

// 3. Ko sederhana (bentuk ko beneran)
{
  // W(1,1) tinggal 1 liberti di (1,2). B capture -> B(1,2) tinggal 1 liberti di (1,1) = ko.
  // W(0,2),W(2,2),W(1,3) menjaga agar B(1,2) cuma punya 1 liberti.
  const g=mk(5,[[0,1,B],[1,0,B],[2,1,B],[1,1,W],[0,2,W],[2,2,W],[1,3,W]]);
  const rko=G.playMove(g,5,B,1+2*5,null); // B(1,2)
  ok(rko && rko.captured.length===1, "ko: capture 1 batu");
  ok(rko.ko===(1+1*5), "ko: titik ko = bekas batu putih");
  const rko2=G.playMove(rko.grid,5,W,1+1*5,rko.ko);
  ok(rko2===null, "ko: recapture langsung ditolak");
  // Putih main ancaman ko di tempat lain -> ko boleh direbut balik
  const rko3=G.playMove(rko.grid,5,W,4+4*5,rko.ko);
  ok(rko3!==null && rko3.ko===null, "ko: ancaman di tempat lain legal & ko cleared");
  const rko3b=G.playMove(rko3.grid,5,B,4+3*5,rko3.ko);
  ok(rko3b!==null, "ko: hitam jawab di tempat lain");
  const rko4=G.playMove(rko3b.grid,5,W,1+1*5,rko3b.ko);
  ok(rko4 && rko4.captured.length===1 && rko4.grid[1+2*5]===E, "ko: putih rebut balik, B(1,2) tertangkap");
  ok(rko4.ko===(1+2*5), "ko: ko baru di titik sebaliknya");
}

// 4. Skoring Tromp-Taylor
{
  // Hitam mengurung (1,1). Putih dikasih batu di pojok jauh biar wilayah luar netral.
  const g=mk(5,[[0,0,B],[1,0,B],[2,0,B],[0,1,B],[0,2,B],[2,1,B],[1,2,B],[2,2,B],[4,4,W],[4,3,W],[3,4,W]]);
  const s=G.scoreTT(g,5);
  ok(s.black===9, "skor: hitam 9 (8 batu + 1 wilayah), dapat "+s.black);
  ok(s.white===3, "skor: putih 3 (3 batu + 0 wilayah), dapat "+s.white);
}

// 5. legalMoves tidak termasuk bunuh diri
{
  const g=mk(5,[[1,2,W],[3,2,W],[2,1,W],[2,3,W]]);
  const ms=G.legalMoves(g,5,B,null);
  ok(!ms.includes(2+2*5), "legalMoves: skip bunuh diri");
  ok(ms.length>0, "legalMoves: ada langkah lain");
}

// 6. Playout & evaluate
{
  const g=G.newGrid(9);
  let rngS=42; const rng=()=>{rngS=(rngS*1103515245+12345)&0x7fffffff;return rngS/0x7fffffff;};
  const d=G.playout(g,9,B,6.5,rng);
  ok(Number.isFinite(d), "playout: selesai dengan skor angka");
  const w=G.evaluate(g,9,B,6.5,10,rng);
  ok(w>=0&&w<=1, "evaluate: winrate 0..1 ("+w+")");
}

// 7. Suggest
{
  const g=G.newGrid(9);
  let rngS=7; const rng=()=>{rngS=(rngS*1103515245+12345)&0x7fffffff;return rngS/0x7fffffff;};
  const s=G.suggest(g,9,B,null,6.5,{maxCands:20,perMove:6},rng);
  ok(s.length===3, "suggest: 3 saran");
  ok(s[0].winrate>=s[1].winrate, "suggest: urut winrate");
  ok(typeof s[0].i==="number", "suggest: ada indeks");
}

// 8. Koordinat
{
  ok(G.coordName(0,19)==="A19", "koordinat A19");
  ok(G.coordName(18,19)==="T19", "koordinat T19 (I dilewati)");
  ok(G.coordName(18*19+18,19)==="T1", "koordinat T1");
}

// 9. Grup & liberti
{
  const g=mk(5,[[2,2,B],[2,3,B]]);
  const grp=G.getGroup(g,5,2+2*5);
  ok(grp.stones.length===2, "grup: 2 batu");
  ok(grp.libs.size===6, "grup: 6 liberti, dapat "+grp.libs.size);
}

console.log(`\n${pass} lolos, ${fail} gagal`);
process.exit(fail?1:0);

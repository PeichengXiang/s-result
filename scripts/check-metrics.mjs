import assert from 'node:assert/strict';
import {data,ranking,selectedCells} from '../work/metrics.mjs';
for(const b of data.benchmarks){
 const rows=ranking(b);assert.equal(rows.length,b.referenceRanking.length);
 rows.forEach((r,i)=>{const expected=b.referenceRanking[i];assert.equal(r.model.id,expected.modelId);assert.equal(r.epoch,expected.epoch);assert.ok(Math.abs(r.rate-expected.rate)<1e-12);assert.equal(r.coverage,b.tasks.length);});
 for(const step of new Set(b.records.map(r=>r.epoch))){assert.ok(selectedCells(b,String(step)).every(r=>r.epoch===step));assert.ok(ranking(b,String(step)).every(r=>r.coverage===b.tasks.length));}
 const raw=JSON.stringify(b);assert.ok(!/\/personal\/|\/mnt\/|root@|checkpoint_path|model_root_path|SBk#|password/i.test(raw),'Private operational fields leaked');
 console.log(b.id,rows.length,'rankings match existing Web selection,',b.records.length,'completed records');
}
const e=data.benchmarks.find(b=>b.id==='egovla');const h=e.models.find(m=>m.label==='H-RDT');const drawer=e.tasks.find(t=>t.source==='Humanoid-Stack-Can-Into-Drawer-v0');const record=e.records.find(p=>p.modelId===h.id&&p.taskId===drawer.id&&p.epoch===80000);assert.ok(Math.abs(record.rate-7/66)<1e-12);assert.ok(!ranking(e).some(x=>x.model.policy==='act'));
console.log('H-RDT restored Unseen score, partial coverage exclusion, weight isolation and publication allowlist passed');

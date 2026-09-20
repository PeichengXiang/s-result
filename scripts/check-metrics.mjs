import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {data,ranking,selectedCells,formatResultUpdateTime} from '../work/metrics.mjs';
import './check-repeated-evaluations.mjs';
assert.equal(formatResultUpdateTime('2026-09-08T09:30:36Z'), '2026年9月8日 17:30');
assert.equal(formatResultUpdateTime('2026-09-08T15:59:59Z'), '2026年9月8日 23:59');
assert.equal(formatResultUpdateTime('2026-09-08T16:00:00Z'), '2026年9月9日 00:00');
assert.equal(formatResultUpdateTime('2026-09-30T16:00:00Z'), '2026年10月1日 00:00');
assert.equal(formatResultUpdateTime('2026-12-31T16:00:00Z'), '2027年1月1日 00:00');
assert.ok(Number.isFinite(Date.parse(data.updatedAt)), 'Result upload timestamp must be valid');
console.log('Result upload timestamps use Beijing time, including midnight and date rollovers');
const {excludedPolicies}=JSON.parse(readFileSync(new URL('../data/publication.json',import.meta.url),'utf8'));
for(const b of data.benchmarks){
 if(b.id==='sparkarena') assert.deepEqual(b.tasks.map(t=>t.source),['click_mouse','collect_objects','dual_bottles_pick','hammer_beat','put_food_in_microwave','retrieve_gap','stack_bowls'],'SparkArena must use the seven canonical tasks');
 assert.ok(b.models.every(m=>!excludedPolicies.includes(m.policy.toLowerCase())),'Unpublished policy was included in public data');
 assert.ok(b.records.every(r=>b.models.some(m=>m.id===r.modelId)),'Public record references a missing model');
 const rows=ranking(b);assert.equal(rows.length,b.referenceRanking.length);
 rows.forEach((r,i)=>{const expected=b.referenceRanking[i];assert.equal(r.model.id,expected.modelId);assert.equal(r.epoch,expected.epoch);assert.ok(Math.abs(r.rate-expected.rate)<1e-12);assert.equal(r.score,expected.score);assert.deepEqual(b.id==='sparkarena'?r.cells:r.cells.map(c=>({taskId:c.taskId,rate:c.rate,score:c.score})),expected.cells);assert.equal(r.coverage,b.tasks.length);});
 for(const step of new Set(b.records.map(r=>r.epoch))){assert.ok(selectedCells(b,String(step)).every(r=>r.epoch===step));assert.ok(ranking(b,String(step)).every(r=>r.coverage===b.tasks.length));}
 const raw=JSON.stringify(b);assert.ok(!/\/personal\/|\/mnt\/|root@|checkpoint_path|model_root_path|SBk#|password/i.test(raw),'Private operational fields leaked');
 console.log(b.id,rows.length,'rankings match existing Web selection,',b.records.length,'completed records');
}
const s=data.benchmarks.find(b=>b.id==='sparkarena');const actSpark=ranking(s).find(x=>x.model.policy==='act');assert.ok(actSpark&&actSpark.coverage===7,'Merged ACT SparkArena result must cover all seven tasks');
const e=data.benchmarks.find(b=>b.id==='egovla');const h=e.models.find(m=>m.label==='H-RDT');const drawer=e.tasks.find(t=>t.source==='Humanoid-Stack-Can-Into-Drawer-v0');const record=e.records.find(p=>p.modelId===h.id&&p.taskId===drawer.id&&p.epoch===80000);assert.ok(Math.abs(record.rate-7/66)<1e-12);const egoRows=selectedCells(e);assert.ok(egoRows.every(row=>row.seen!==null),'EgoVLA selected rows must preserve Seen SR');egoRows.forEach(row=>{const cells=row.cells.filter(Boolean);assert.ok(Math.abs(row.seen-cells.reduce((sum,cell)=>sum+cell.seen,0)/row.coverage)<1e-12,'EgoVLA Seen SR must be the selected-task average')});const actEgo=egoRows.find(x=>x.model.policy==='act');assert.ok(actEgo&&actEgo.coverage===11,'Merged ACT EgoVLA result must remain a single partial model');assert.ok(!ranking(e).some(x=>x.model.policy==='act'),'Partial ACT EgoVLA result must not enter the formal ranking');
console.log('H-RDT restored Unseen score, Seen SR aggregation, ACT grouping, partial coverage exclusion, weight isolation and publication allowlist passed');

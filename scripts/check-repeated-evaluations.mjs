import assert from 'node:assert/strict';
import { data, ranking, selectedCells, leaders } from '../work/metrics.mjs';

const source = data.benchmarks.find((b) => b.id === 'sparkarena');
const model = { ...source.models[0], id: 'test-model', policy: 'test' };
const tasks = source.tasks.slice(0, 2);
const record = (id, task, rate, round, epoch = 80000) => ({
  id: `r${id}`, modelId: model.id, taskId: tasks[task].id,
  epoch, actualStep: epoch, rate, score: rate * 100,
  seen: null, rollouts: 50, round,
});
const benchmark = (records) => ({ ...source, models: [model], tasks, records });
const oldZero = [record(1, 0, 0, 'old'), record(2, 1, 0, 'old')];

const reruns = benchmark([
  ...oldZero, record(3, 0, 0.12, 'rerun-a'), record(4, 1, 0.5, 'rerun-b'),
]);
assert.deepEqual(ranking(reruns)[0].cells.map((r) => r.id), ['r3', 'r4']);
assert.equal(ranking(reruns)[0].rate, 0.31);

// SparkArena latest task results replace older complete batches.
const complete = benchmark([
  record(1, 0, 0.9, 'a'), record(2, 1, 0.1, 'a'),
  record(3, 0, 0.6, 'b'), record(4, 1, 0.6, 'b'),
  record(5, 0, 1, 'single'),
]);
assert.deepEqual(ranking(complete)[0].cells.map((r) => r.id), ['r5', 'r4']);
// EgoVLA uses the same latest-task selection as the eval Web leaderboard.
assert.deepEqual(ranking({ ...complete, id: 'egovla' })[0].cells.map((r) => r.id), ['r5', 'r4']);

const latestLower = benchmark([
  record(10, 0, 0.2, 'new-a'), record(2, 1, 0.6, 'old'),
  record(9, 0, 0.9, 'old'), record(11, 1, 0, 'new-b'),
]);
assert.deepEqual(ranking(latestLower)[0].cells.map((r) => r.id), ['r10', 'r11']);
assert.equal(ranking(latestLower)[0].rate, 0.1);
assert.deepEqual(ranking({ ...latestLower, records: [...latestLower.records].reverse() }), ranking(latestLower));
assert.equal(leaders(latestLower)[0].winners[0].id, 'r9');

// Drop whole all-zero layers, never individual zero-valued task records.
const zeroLayers = benchmark([
  record(1, 0, 0.4, 'old'), record(2, 1, 0.8, 'old'),
  record(3, 0, 0, 'middle-a'), record(4, 1, 0, 'middle-b'),
  record(5, 0, 0, 'new-a'), record(6, 1, 0, 'new-b'),
]);
assert.deepEqual(ranking(zeroLayers)[0].cells.map((r) => r.id), ['r1', 'r2']);
assert.equal(ranking(benchmark([
  record(1, 0, 0.8, 'old'), record(2, 0, 0, 'new'), record(3, 1, 0, 'new'),
])).length, 0);

// A zero task in a positive complete batch remains valid.
const withZeroTask = benchmark([record(1, 0, 0, 'a'), record(2, 1, 0.8, 'a')]);
assert.equal(ranking(withZeroTask)[0].rate, 0.4);
assert.equal(ranking(withZeroTask)[0].cells[0].rate, 0);
assert.equal(ranking(benchmark(oldZero)).length, 0);
assert.equal(selectedCells(benchmark(oldZero))[0].coverage, 2);

// Different checkpoints or missing tasks never form a complete total row.
const differentSteps = benchmark([
  record(1, 0, 0.5, 'a', 70000), record(2, 1, 0.6, 'b', 80000),
]);
assert.equal(ranking(differentSteps).length, 0);
assert.equal(ranking(benchmark([record(1, 0, 0.5, 'a')])).length, 0);
const otherModel = { ...model, id: 'other-model' };
assert.equal(ranking({ ...benchmark([
  record(1, 0, 0.5, 'a'), { ...record(2, 1, 0.6, 'a'), modelId: otherModel.id },
]), models: [model, otherModel] }).length, 0);
console.log('Repeated evaluations: latest task layers, zero-layer fallback, model/checkpoint isolation and historical leaders passed');

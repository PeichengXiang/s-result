import assert from 'node:assert/strict';
import { data, ranking, selectedCells } from '../work/metrics.mjs';

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

// Preserve a positive complete batch instead of combining task peaks.
const complete = benchmark([
  record(1, 0, 0.9, 'a'), record(2, 1, 0.1, 'a'),
  record(3, 0, 0.6, 'b'), record(4, 1, 0.6, 'b'),
  record(5, 0, 1, 'single'),
]);
assert.deepEqual(ranking(complete)[0].cells.map((r) => r.id), ['r3', 'r4']);

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
console.log('Repeated evaluations: zero-batch fallback, complete-round priority, zero tasks and checkpoint isolation passed');

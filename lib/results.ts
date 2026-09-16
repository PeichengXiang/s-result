import snapshot from '@/data/results.json';
export type Benchmark = (typeof snapshot.benchmarks)[number];
export type RecordRow = Benchmark['records'][number];
export type Model = Benchmark['models'][number];
export type Summary = {
  model: Model;
  epoch: number;
  rate: number;
  score: number | null;
  cells: (RecordRow | null)[];
  coverage: number;
};
export const data = snapshot;
export const formatResultUpdateTime = (value: string) =>
  new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(new Date(value));
export const pct = (x: number | null | undefined) =>
  x == null ? '—' : `${(x * 100).toFixed(1)}%`;
export const displayStep = (n: number, benchmarkId?: string, policy?: string) =>
  benchmarkId === 'sparkarena' && policy === 'pi_05' && n === 79999 ? 80000 : n;
export const stepLabel = (n: number, benchmarkId?: string, policy?: string) => {
  const step = displayStep(n, benchmarkId, policy);
  return step >= 10000 ? `${+(step / 10000).toFixed(4)}w` : `${step.toLocaleString()} steps`;
};
export function better(a: RecordRow, b: RecordRow) {
  return (
    b.rate - a.rate ||
    (b.score ?? -1) - (a.score ?? -1) ||
    b.rollouts - a.rollouts ||
    Number(b.id.slice(1)) - Number(a.id.slice(1))
  );
}
export function compare(a: Summary, b: Summary) {
  return (
    b.rate - a.rate || (b.score ?? -1) - (a.score ?? -1) || b.epoch - a.epoch
  );
}
function latestTaskCells(bench: Benchmark, points: RecordRow[]) {
  let remaining = points;
  while (true) {
    const cells = bench.tasks.map(
      (task) => remaining
        .filter((point) => point.taskId === task.id)
        .sort((a, b) => Number(b.id.slice(1)) - Number(a.id.slice(1)) || better(a, b))[0] ?? null,
    );
    // Match the Web leaderboard: keep the latest task layer, including
    // individual zero scores. Only an entirely zero layer falls back.
    if (cells.some((point) => point === null) || cells.some((point) => point!.rate > 0))
      return cells;
    const selected = new Set(cells);
    const earlier = remaining.filter((point) => !selected.has(point));
    if (!earlier.length) return cells;
    remaining = earlier;
  }
}
export function selectedCells(bench: Benchmark, epoch = 'all') {
  const groups = new Map<string, RecordRow[]>();
  for (const p of bench.records) {
    if (epoch !== 'all' && p.epoch !== Number(epoch)) continue;
    const key = `${p.modelId}:${p.epoch}`;
    groups.set(key, [...(groups.get(key) ?? []), p]);
  }
  return [...groups.values()].map((points) => {
    // Match the current eval Web leaderboard for every benchmark: a newer
    // completed task evaluation replaces the older value at the same step.
    const cells = latestTaskCells(bench, points),
      valid = cells.filter((x): x is RecordRow => x !== null);
    return {
      model: bench.models.find((m) => m.id === points[0].modelId)!,
      epoch: points[0].epoch,
      rate: valid.reduce((s, p) => s + p.rate, 0) / valid.length,
      score: valid.every((x) => x.score != null)
        ? valid.reduce((s, x) => s + x.score!, 0) / valid.length
        : null,
      cells,
      coverage: valid.length,
    };
  });
}
export function ranking(bench: Benchmark, epoch = 'all') {
  const best = new Map<string, Summary>();
  for (const row of selectedCells(bench, epoch)
    .filter((x) => x.coverage === bench.tasks.length && x.rate > 0)
    .sort(compare))
    if (!best.has(row.model.policy)) best.set(row.model.policy, row);
  return [...best.values()].sort(compare);
}
export function leaders(bench: Benchmark, epoch = 'all') {
  return bench.tasks.map((task) => {
    const records = bench.records
      .filter(
        (p) =>
          p.taskId === task.id &&
          (epoch === 'all' || p.epoch === Number(epoch)),
      )
      .sort(better);
    return {
      task,
      rate: records[0]?.rate ?? null,
      winners: records
        .filter((p) => Math.abs(p.rate - (records[0]?.rate ?? -1)) < 1e-12)
        .filter((p, i, a) => a.findIndex((x) => x.modelId === p.modelId) === i),
    };
  });
}

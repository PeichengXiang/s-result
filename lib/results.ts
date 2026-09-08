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
export const pct = (x: number | null | undefined) =>
  x == null ? '—' : `${(x * 100).toFixed(1)}%`;
export const stepLabel = (n: number) =>
  n >= 10000 ? `${+(n / 10000).toFixed(4)}w` : `${n.toLocaleString()} steps`;
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
export function selectedCells(bench: Benchmark, epoch = 'all') {
  const groups = new Map<string, RecordRow[]>();
  for (const p of bench.records) {
    if (epoch !== 'all' && p.epoch !== Number(epoch)) continue;
    const key = `${p.modelId}:${p.epoch}`;
    groups.set(key, [...(groups.get(key) ?? []), p]);
  }
  return [...groups.values()].map((points) => {
    const rounds = new Map<string, RecordRow[]>();
    for (const p of points)
      rounds.set(p.round, [...(rounds.get(p.round) ?? []), p]);
    const rows = (ps: RecordRow[]) =>
      bench.tasks.map(
        (t) => ps.filter((p) => p.taskId === t.id).sort(better)[0] ?? null,
      );
    const full = [...rounds.values()]
      .map(rows)
      .filter((ps) => ps.every(Boolean))
      .sort((a, b) => {
        const rate = (p: (RecordRow | null)[]) =>
          p.reduce((s, x) => s + x!.rate, 0) / p.length;
        const score = (p: (RecordRow | null)[]) =>
          p.every((x) => x!.score != null)
            ? p.reduce((s, x) => s + x!.score!, 0) / p.length
            : -1;
        return (
          rate(b) - rate(a) ||
          score(b) - score(a) ||
          Math.max(...b.map((x) => Number(x!.id.slice(1)))) -
            Math.max(...a.map((x) => Number(x!.id.slice(1))))
        );
      });
    const cells = full[0] ?? rows(points),
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
    .filter((x) => x.coverage === bench.tasks.length)
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

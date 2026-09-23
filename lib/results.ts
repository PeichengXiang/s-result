import snapshot from '@/data/results.json';
import egoPsrSnapshot from '@/data/egovla-psr.json';
export type Benchmark = (typeof snapshot.benchmarks)[number];
export type RecordRow = Benchmark['records'][number];
export type Model = Benchmark['models'][number];
export type Summary = {
  model: Model;
  epoch: number;
  rate: number;
  seen: number | null;
  score: number | null;
  cells: (RecordRow | null)[];
  coverage: number;
};
type EgoRecord = RecordRow & {
  /** Official release-v7 progress rate when the snapshot contains it. */
  psrSeen?: number | null;
  psrUnseen?: number | null;
  /** Campaign key used to keep ACT's independent evaluation campaigns intact. */
  actCampaign?: string;
};
export type EgoSplit = 'seen' | 'unseen';
export type EgoHorizon = 'short' | 'long';
export type EgoSetting = {
  key: string;
  label: string;
};
export type EgoLeaderboardRow = {
  setting: EgoSetting;
  model: Model;
  epoch: number;
  cells: (RecordRow | null)[];
  rate: number;
  psr: number | null;
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
export const modelWeightLabel = (
  model: Model,
  epoch: number,
  benchmarkId?: string,
) =>
  'weightLabel' in model && typeof model.weightLabel === 'string'
    ? model.weightLabel
    : stepLabel(epoch, benchmarkId, model.policy);
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
      seen:
        bench.id === 'egovla' && valid.every((p) => p.seen != null)
          ? valid.reduce((s, p) => s + p.seen!, 0) / valid.length
          : null,
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
export function supplementalRows(bench: Benchmark, epoch = 'all') {
  return selectedCells(bench, epoch)
    .filter(
      (row) =>
        'showPartial' in row.model &&
        row.model.showPartial === true &&
        row.coverage > 0 &&
        row.coverage < bench.tasks.length,
    )
    .sort(compare);
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

const EGO_SHORT_SOURCES = [
  'Humanoid-Stack-Can-v0',
  'Humanoid-Push-Box-v0',
  'Humanoid-Open-Drawer-v0',
  'Humanoid-Close-Drawer-v0',
  'Humanoid-Flip-Mug-v0',
  'Humanoid-Pour-Balls-v0',
  'Humanoid-Open-Laptop-v0',
] as const;
const EGO_LONG_SOURCES = [
  'Humanoid-Insert-And-Unload-Cans-v0',
  'Humanoid-Stack-Can-Into-Drawer-v0',
  'Humanoid-Sort-Cans-v0',
  'Humanoid-Unload-Cans-v0',
  'Humanoid-Insert-Cans-v0',
] as const;

/** The four paper-table configurations use this fixed task order. */
export function egoVlaTaskGroups(bench: Benchmark) {
  const bySource = new Map(bench.tasks.map((task) => [task.source, task]));
  const short = EGO_SHORT_SOURCES.map((source) => bySource.get(source)).filter(
    (task): task is Benchmark['tasks'][number] => Boolean(task),
  );
  const long = EGO_LONG_SOURCES.map((source) => bySource.get(source)).filter(
    (task): task is Benchmark['tasks'][number] => Boolean(task),
  );
  return { short, long };
}

/**
 * These are the same explicit model-name buckets used by eval web's
 * `sparkSettingPolicyKey`.  Keep this list-based mapping instead of inferring
 * a setting from a substring in the display name: new/experimental model
 * names must stay in eval web's `no pretrain` bucket until eval web assigns
 * them explicitly.
 */
const EGO_VISUAL_PRETRAIN_MODELS = new Set([
  'egovla_spark_visual_pretrain',
]);
const EGO_TACTILE_100H_PRETRAIN_MODELS = new Set([
  'egovla_spark_tactile100h_pretrain',
]);
const EGO_INSPIRE_MODELS = new Set([
  'spark0-0914-inspire12-egovla',
]);

/** Match eval web's exact Spark setting buckets for EgoVLA. */
export function egoVlaSetting(model: Model): EgoSetting {
  const policy = model.policy.toLowerCase();
  if (policy === 'act') return { key: 'act', label: 'ACT' };
  if (policy === 'spark_0') {
    const name = model.name.toLowerCase();
    if (EGO_VISUAL_PRETRAIN_MODELS.has(name))
      return { key: 'spark_visual_pretrain', label: 'Spark(visual pretrain)' };
    if (EGO_TACTILE_100H_PRETRAIN_MODELS.has(name))
      return {
        key: 'spark_tactile_100h_pretrain',
        label: 'Spark(tactile-100h pretrain)',
      };
    if (EGO_INSPIRE_MODELS.has(name))
      return { key: 'spark_inspire', label: 'Spark(inspire)' };
    return { key: 'spark_no_pretrain', label: 'Spark(no pretrain)' };
  }
  return { key: policy, label: model.label };
}

function egoMetric(point: RecordRow, split: EgoSplit) {
  return split === 'seen' ? point.seen : point.rate;
}

function egoPsr(point: RecordRow, split: EgoSplit) {
  const value = (point as EgoRecord)[
    split === 'seen' ? 'psrSeen' : 'psrUnseen'
  ];
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const saved = (egoPsrSnapshot as Record<string, { seen?: number | null; unseen?: number | null }>)[point.id]?.[
    split
  ];
  return typeof saved === 'number' && Number.isFinite(saved) ? saved : null;
}

function betterEgoPoint(a: RecordRow, b: RecordRow, split: EgoSplit) {
  return (
    (egoMetric(b, split) ?? -1) - (egoMetric(a, split) ?? -1) ||
    (egoPsr(b, split) ?? -1) - (egoPsr(a, split) ?? -1) ||
    (b.score ?? -1) - (a.score ?? -1) ||
    b.rollouts - a.rollouts ||
    Number(b.id.slice(1)) - Number(a.id.slice(1))
  );
}

/**
 * Reproduce the eval Web EgoVLA paper-table selection:
 * select the best repeat independently for each model/step/task, then select
 * the best step inside each policy/setting by the equal-weight mean.
 */
export function egoVlaLeaderboard(
  bench: Benchmark,
  horizon: EgoHorizon,
  split: EgoSplit,
  epoch = 'all',
) {
  const groups = egoVlaTaskGroups(bench);
  const tasks = groups[horizon];
  const taskIds = new Set(tasks.map((task) => task.id));
  const byModelEpoch = new Map<string, RecordRow[]>();
  for (const point of bench.records) {
    if (
      !taskIds.has(point.taskId) ||
      (epoch !== 'all' && point.epoch !== Number(epoch))
    )
      continue;
    const campaign =
      bench.models.find((model) => model.id === point.modelId)?.policy === 'act'
        ? ((point as EgoRecord).actCampaign ?? 'default')
        : '';
    const key = `${point.modelId}:${point.epoch}:${campaign}`;
    byModelEpoch.set(key, [...(byModelEpoch.get(key) ?? []), point]);
  }
  const candidates: EgoLeaderboardRow[] = [];
  for (const points of byModelEpoch.values()) {
    const model = bench.models.find((item) => item.id === points[0].modelId);
    if (!model) continue;
    const cells = tasks.map(
      (task) =>
        points
          .filter((point) => point.taskId === task.id)
          .sort((a, b) => betterEgoPoint(a, b, split))[0] ?? null,
    );
    if (cells.some((cell) => cell === null)) continue;
    const enrichedCells = cells.map((cell) =>
      cell
        ? ({
            ...cell,
            psrSeen: egoPsr(cell, 'seen'),
            psrUnseen: egoPsr(cell, 'unseen'),
          } as RecordRow)
        : null,
    );
    const valid = enrichedCells.filter(
      (cell): cell is RecordRow => cell !== null,
    );
    const rates = valid
      .map((point) => egoMetric(point, split))
      .filter((value): value is number => typeof value === 'number');
    if (rates.length !== tasks.length) continue;
    const psrs = valid.map((point) => egoPsr(point, split));
    const finitePsrs = psrs.filter(
      (value): value is number => typeof value === 'number',
    );
    candidates.push({
      setting: egoVlaSetting(model),
      model,
      epoch: points[0].epoch,
      cells: enrichedCells,
      rate: rates.reduce((sum, value) => sum + value, 0) / rates.length,
      psr:
        finitePsrs.length === rates.length
          ? finitePsrs.reduce((sum, value) => sum + value, 0) /
            finitePsrs.length
          : null,
      coverage: valid.length,
    });
  }
  const best = new Map<string, EgoLeaderboardRow>();
  for (const candidate of candidates) {
    const current = best.get(candidate.setting.key);
    if (
      !current ||
      candidate.rate > current.rate + 1e-12 ||
      (Math.abs(candidate.rate - current.rate) < 1e-12 &&
        (candidate.psr ?? -1) > (current.psr ?? -1) + 1e-12) ||
      (Math.abs(candidate.rate - current.rate) < 1e-12 &&
        Math.abs((candidate.psr ?? -1) - (current.psr ?? -1)) < 1e-12 &&
        candidate.epoch > current.epoch)
    )
      best.set(candidate.setting.key, candidate);
  }
  return [...best.values()].sort(
    (a, b) =>
      b.rate - a.rate ||
      (b.psr ?? -1) - (a.psr ?? -1) ||
      a.setting.label.localeCompare(b.setting.label),
  );
}

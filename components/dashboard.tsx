'use client';
import { useEffect, useMemo, useState } from 'react';
import { ArrowDown, ChartNoAxesColumnIncreasing } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import { LoginDialog, NoteDialog, type EditTarget } from './notes';
import { api, type Note } from '@/lib/notes-client';
import {
  data,
  ranking,
  supplementalRows,
  leaders,
  pct,
  stepLabel,
  modelWeightLabel,
  displayStep,
  formatResultUpdateTime,
  egoVlaLeaderboard,
  egoVlaSetting,
  egoVlaTaskGroups,
  type EgoHorizon,
  type EgoSplit,
  type Benchmark,
} from '@/lib/results';

function EgoSettingTables({
  bench,
  epoch,
  notes,
  edit,
  warning,
}: {
  bench: Benchmark;
  epoch: string;
  notes: Note[];
  edit: (target: EditTarget) => void;
  warning: (modelId: string) => boolean;
}) {
  const groups = egoVlaTaskGroups(bench);
  const configuredSettings = new Map([
    ['act', 'ACT'],
    ['spark_no_pretrain', 'Spark(no pretrain)'],
    ['spark_visual_pretrain', 'Spark(visual pretrain)'],
    ['spark_tactile_100h_pretrain', 'Spark(tactile-100h pretrain)'],
    ['spark_tactile_full_pretrain', 'Spark(tactile-full pretrain)'],
    ['spark_inspire', 'Spark(inspire)'],
  ]);
  for (const model of bench.models) {
    const setting = egoVlaSetting(model);
    configuredSettings.set(setting.key, setting.label);
  }

  const renderTable = (horizon: EgoHorizon, split: EgoSplit) => {
    const tasks = groups[horizon];
    const rows = egoVlaLeaderboard(bench, horizon, split, epoch).filter(
      (row) => row.rate > 0,
    );
    const bySetting = new Map(rows.map((row) => [row.setting.key, row]));
    const ordered = [
      ...rows,
      ...[...configuredSettings.entries()]
        .filter(([key]) => !bySetting.has(key))
        .map(([key, label]) => ({
          setting: { key, label },
          model: null,
          epoch: null,
          cells: tasks.map(() => null),
          rate: null,
          psr: null,
          coverage: 0,
        })),
    ];
    return (
      <div className="egovla-setting-table" key={`${horizon}-${split}`}>
        <div className="section-head">
          <h3>
            {split === 'seen' ? 'Seen' : 'Unseen'} ·{' '}
            {horizon === 'short' ? 'Short horizon（7 tasks）' : 'Long horizon（5 tasks）'}
          </h3>
          <span>按 {split === 'seen' ? 'Seen' : 'Unseen'} SR 排名</span>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>排名 / Setting</TableHead>
              <TableHead>模型 / 权重</TableHead>
              <TableHead>备注</TableHead>
              <TableHead>Mean SR</TableHead>
              <TableHead>Mean PSR</TableHead>
              {tasks.map((task) => (
                <TableHead key={task.id} className="task-column" title={task.source}>
                  <span>{task.label}</span>
                  <small className="task-english" lang="en">
                    {task.short.replaceAll('-', ' ')}
                  </small>
                  <small className="task-metric">SR / PSR</small>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {ordered.map((row, index) => {
              const model = row.model;
              const isPlaceholder = !model;
              return (
                <TableRow
                  key={`${split}-${horizon}-${row.setting.key}`}
                  className={model && warning(model.id) ? 'abnormal-row' : ''}
                >
                  <TableCell>
                    <span className="rank">
                      {isPlaceholder ? '—' : String(index + 1).padStart(2, '0')}
                    </span>
                    <strong>{row.setting.label}</strong>
                  </TableCell>
                  <TableCell>
                    {model ? (
                      <>
                        <strong>{model.label}</strong>
                        <small className="model-version">
                          {model.name} · {modelWeightLabel(model, row.epoch!, bench.id)}
                        </small>
                      </>
                    ) : (
                      <span className="model-version">暂无完整评测</span>
                    )}
                  </TableCell>
                  <TableCell className="note-cell">
                    {model &&
                      notes
                        .filter(
                          (note) =>
                            note.key.startsWith(`${bench.id}:${model.id}`) &&
                            note.text,
                        )
                        .map((note) => (
                          <p key={note.key}>
                            {note.abnormal ? '⚠️ ' : ''}
                            {note.text}
                          </p>
                        ))}
                    {model && (
                      <Button
                        variant="ghost"
                        onClick={() =>
                          edit({
                            key: `${bench.id}:${model.id}`,
                            title: `${model.label} · ${row.setting.label} 备注`,
                          })
                        }
                      >
                        ＋ 备注
                      </Button>
                    )}
                  </TableCell>
                  <TableCell className="average">
                    {row.rate == null ? '—' : pct(row.rate)}
                  </TableCell>
                  <TableCell className="average seen-average">
                    {row.psr == null ? '—' : pct(row.psr)}
                  </TableCell>
                  {row.cells.map((cell, taskIndex) => {
                    const point = cell as (typeof cell) & {
                      psrSeen?: number | null;
                      psrUnseen?: number | null;
                    };
                    const value = point
                      ? split === 'seen'
                        ? point.seen
                        : point.rate
                      : null;
                    const psr = point
                      ? split === 'seen'
                        ? point.psrSeen
                        : point.psrUnseen
                      : null;
                    return (
                      <TableCell key={tasks[taskIndex]?.id ?? taskIndex} className="task-score">
                        {isPlaceholder ? (
                          '—'
                        ) : (
                          <>
                            <span>{pct(value)}</span>
                            <small>PSR {pct(psr)}</small>
                          </>
                        )}
                      </TableCell>
                    );
                  })}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    );
  };

  return (
    <section id="overall" className="table-section egovla-overall">
      <div className="section-head">
        <div>
          <h1>{bench.name} · 总评测表</h1>
          <p className="table-hint">
            与 eval web 一致：短程 / 长程分别报告 Seen、Unseen；每个 setting 内按任务逐项选择最佳完整测评，再按 Mean SR 排名。
          </p>
        </div>
        <a href="#method">
          统计口径 <ArrowDown size={14} />
        </a>
      </div>
      <div className="egovla-setting-grid">
        {renderTable('short', 'seen')}
        {renderTable('short', 'unseen')}
        {renderTable('long', 'seen')}
        {renderTable('long', 'unseen')}
      </div>
      <p className="table-hint">
        PSR 使用快照中的 release-v7 指标；旧记录没有该字段时保留空值。0 分的 setting 不进入排名，但仍保留 setting 行以说明当前没有可展示的完整成绩。
      </p>
    </section>
  );
}

export default function Dashboard() {
  const [active, setActive] = useState('sparkarena');
  const [epoch, setEpoch] = useState('all');
  const [notes, setNotes] = useState<Note[]>([]),
    [notesError, setNotesError] = useState(''),
    [authenticated, setAuthenticated] = useState(false),
    [login, setLogin] = useState(false),
    [target, setTarget] = useState<EditTarget | null>(null);
  useEffect(() => {
    const q = new URLSearchParams(location.search);
    if (data.benchmarks.some((b) => b.id === q.get('benchmark')))
      setActive(q.get('benchmark')!);
    if (q.has('login')) setLogin(true);
    if (q.get('edit')) setTarget({ key: q.get('edit')!, title: '编辑备注' });
    void reloadNotes();
    void api('session')
      .then((s) => setAuthenticated(s.authenticated))
      .catch(() => {});
  }, []);
  async function reloadNotes() {
    try {
      const s = await api('notes');
      setNotes(s.notes);
      setNotesError('');
    } catch (e) {
      setNotesError((e as Error).message);
    }
  }
  function edit(t: EditTarget) {
    setTarget(t);
    if (!authenticated) setLogin(true);
  }
  function openLogin() {
    setLogin(true);
  }
  async function logout() {
    try {
      await api('session', 'DELETE');
      setAuthenticated(false);
    } catch (e) {
      setNotesError((e as Error).message);
    }
  }
  const bench = data.benchmarks.find((b) => b.id === active)!;
  const isEgoVLA = bench.id === 'egovla';
  const rows = useMemo(() => ranking(bench, epoch), [bench, epoch]);
  const partialRows = useMemo(() => supplementalRows(bench, epoch), [bench, epoch]);
  const wins = useMemo(() => leaders(bench, epoch), [bench, epoch]);
  const filterStepLabel = (n: number) => bench.id === 'sparkarena' && n === 79999
    ? `${stepLabel(n, bench.id, 'pi_05')}（π0.5）`
    : stepLabel(n);
  const epochs = [...new Set(bench.records.map((r) => r.epoch))].sort(
    (a, b) => a - b,
  );
  const warning = (modelId: string) =>
    notes.some((n) => n.abnormal && n.key.startsWith(`${active}:${modelId}`));
  const renderScoreRow = (
    row: (typeof rows)[number],
    rank: string,
    supplemental = false,
  ) => (
    <TableRow
      key={row.model.id}
      className={warning(row.model.id) ? 'abnormal-row' : ''}
    >
      <TableCell>
        <span className="rank">{rank}</span>
        <strong>
          {warning(row.model.id) && '⚠️ '}
          {row.model.label}
        </strong>
        <small className="model-version">{row.model.name}</small>
      </TableCell>
      <TableCell>
        {modelWeightLabel(row.model, row.epoch, bench.id)}
      </TableCell>
      <TableCell className="average">
        {pct(row.rate)}
        {supplemental && (
          <small className="model-version">
            已完成 {row.coverage}/{bench.tasks.length} 项
          </small>
        )}
      </TableCell>
      {isEgoVLA && (
        <TableCell className="average seen-average">
          {pct(row.seen)}
        </TableCell>
      )}
      <TableCell className="note-cell">
        {notes
          .filter(
            (n) => n.key.startsWith(`${active}:${row.model.id}`) && n.text,
          )
          .map((n) => (
            <p key={n.key}>
              {n.abnormal ? '⚠️ ' : ''}
              {n.text}
            </p>
          ))}
        <Button
          variant="ghost"
          onClick={() =>
            edit({
              key: `${active}:${row.model.id}`,
              title: `${row.model.label} · 模型备注`,
            })
          }
        >
          ＋ 备注
        </Button>
      </TableCell>
      {row.cells.map((c, j) => (
        <TableCell key={j} className={isEgoVLA ? 'task-score' : undefined}>
          {isEgoVLA ? (
            <>
              <span>{pct(c?.rate)}</span>
              <small>Seen {pct(c?.seen)}</small>
            </>
          ) : (
            pct(c?.rate)
          )}
        </TableCell>
      ))}
    </TableRow>
  );
  useEffect(() => {
    const context = (
      document as unknown as {
        modelContext?: {
          registerTool: (
            tool: unknown,
            options: { signal: AbortSignal },
          ) => void;
        };
      }
    ).modelContext;
    if (!context) return;
    const abort = new AbortController();
    try {
      context.registerTool(
        {
          name: 'select_benchmark',
          description: '切换可见 benchmark 和权重筛选，不修改成绩或备注。',
          inputSchema: {
            type: 'object',
            properties: {
              benchmark: { type: 'string', enum: ['sparkarena', 'egovla'] },
              epoch: { type: 'integer' },
            },
            required: ['benchmark'],
            additionalProperties: false,
          },
          annotations: { readOnlyHint: false },
          execute: async (input: unknown) => {
            const v = input as { benchmark: string; epoch?: number };
            const b = data.benchmarks.find((x) => x.id === v.benchmark);
            if (
              !b ||
              (v.epoch !== undefined &&
                !b.records.some((r) => r.epoch === v.epoch))
            )
              throw new Error('无此 benchmark 或权重');
            setActive(b.id);
            setEpoch(v.epoch === undefined ? 'all' : String(v.epoch));
            await new Promise<void>((resolve) =>
              requestAnimationFrame(() => resolve()),
            );
            return {
              benchmark: b.name,
              epoch: v.epoch ?? 'all',
              models: ranking(
                b,
                v.epoch === undefined ? 'all' : String(v.epoch),
              ).map((r) => ({
                name: r.model.label,
                unseenSuccessRate: r.rate,
                ...(b.id === 'egovla' ? { seenSuccessRate: r.seen } : {}),
              })),
            };
          },
        },
        { signal: abort.signal },
      );
    } catch {
      /* Unsupported experimental API does not affect the page. */
    }
    return () => abort.abort();
  }, []);
  return (
    <main className="arena" data-benchmark={active}>
      <header className="masthead">
        <a href="#" className="brand">
          <ChartNoAxesColumnIncreasing size={23} />
          <span>MODEL BENCHMARKS</span>
        </a>
        <div className="header-actions">
          <span className="live-label">
            公开成绩 · 最近上传：
            <time dateTime={data.updatedAt}>
              {formatResultUpdateTime(data.updatedAt)}
            </time>
            {' （北京时间）'}
          </span>
          <Button
            variant="outline"
            onClick={authenticated ? logout : openLogin}
          >
            {authenticated ? 'xiangpc · 退出' : '管理员登录'}
          </Button>
        </div>
      </header>
      <Tabs
        value={active}
        onValueChange={(v) => {
          setActive(String(v));
          setEpoch('all');
        }}
      >
        <TabsList className="benchmark-tabs">
          <TabsTrigger value="sparkarena">
            <strong>SparkArena</strong>
            <span>DexBench / Spark 0</span>
          </TabsTrigger>
          <TabsTrigger value="egovla">
            <strong>EgoVLA Benchmark</strong>
            <span>Humanoid / 12 tasks</span>
          </TabsTrigger>
        </TabsList>
      </Tabs>
      <div className="filters">
        <label>
          权重范围{' '}
          <Select value={epoch} onValueChange={(v) => setEpoch(String(v))}>
            <SelectTrigger aria-label="权重范围">
              <SelectValue>
                {epoch === 'all' ? '所有已完成权重' : filterStepLabel(Number(epoch))}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">所有已完成权重</SelectItem>
              {epochs.map((n) => (
                <SelectItem key={n} value={String(n)}>
                  {filterStepLabel(n)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
        <span>
          共{' '}
          {
            bench.records.filter(
              (r) => epoch === 'all' || r.epoch === Number(epoch),
            ).length
          }{' '}
          条完整测评
        </span>
      </div>
      {notesError && (
        <div className="notice" role="status">
          {notesError}{' '}
          <Button variant="ghost" onClick={reloadNotes}>
            重试
          </Button>
        </div>
      )}
      {notes.some((n) => n.abnormal && n.key.startsWith(active + ':')) && (
        <div className="warning-banner" role="status">
          <strong>⚠️ 部分模型已被标记异常</strong>
          <span>请结合表格备注解读相关成绩。</span>
        </div>
      )}
      {isEgoVLA ? (
        <EgoSettingTables
          bench={bench}
          epoch={epoch}
          notes={notes}
          edit={edit}
          warning={warning}
        />
      ) : (
      <section id="overall" className="table-section">
        <div className="section-head">
          <h1>{bench.name} · 总成绩</h1>
          <a href="#method">
            统计口径 <ArrowDown size={14} />
          </a>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>排名 / 模型</TableHead>
              <TableHead>权重</TableHead>
              <TableHead>{isEgoVLA ? 'Unseen SR（排名）' : '平均成功率'}</TableHead>
              {isEgoVLA && <TableHead>Seen SR</TableHead>}
              <TableHead>备注</TableHead>
              {bench.tasks.map((t) => (
                <TableHead key={t.id} className="task-column" title={t.source}>
                  <span>{t.label}</span>
                  <small className="task-english" lang="en">
                    {t.short.replaceAll('-', ' ')}
                  </small>
                  {isEgoVLA && <small className="task-metric">Unseen / Seen</small>}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row, i) =>
              renderScoreRow(row, String(i + 1).padStart(2, '0')),
            )}
            {partialRows.map((row) => renderScoreRow(row, '补充', true))}
          </TableBody>
        </Table>
        <p className="table-hint">
          当前总榜要求同一模型权重覆盖 {bench.tasks.length} 项正式任务。
        </p>
        <p className="table-hint">
          {isEgoVLA
            ? 'Unseen SR 用于排名；Seen SR 同时公开，仅供对比。两个指标均按任务等权平均。'
            : '每种模型选择全任务平均最高的同一权重；各任务等权平均。'}
        </p>
        {partialRows.length > 0 && (
          <p className="table-hint">
            “补充”行展示已完成任务的平均值，不参与正式排名。
          </p>
        )}
        {bench.models.some(
          (model) => 'mergedTaskResults' in model && model.mergedTaskResults,
        ) && (
          <p className="table-hint">
            ACT 的按任务测评结果已合并为一个模型；每个任务保留其原始权重。
          </p>
        )}
      </section>
      )}
      {!rows.length && !isEgoVLA && (
        <div className="empty-state">
          当前权重尚无覆盖全部 {bench.tasks.length}{' '}
          个任务的模型，请选择其他权重范围。
        </div>
      )}
      <section className="leader-section">
        <div className="section-head">
          <h2>各任务，谁在领先</h2>
          <span>
            {isEgoVLA
              ? '单任务最佳 Unseen SR · 同时展示 Seen SR'
              : '单任务最佳成功率 · 可来自不同权重'}
          </span>
        </div>
        <div className="leaders-grid">
          {wins.map(({ task, rate, winners }, i) => (
            <article key={task.id} className="leader-item">
              <div className="leader-top">
                <span className="index">{String(i + 1).padStart(2, '0')}</span>
                <strong title={task.source}>
                  {task.label}
                  <small className="task-english" lang="en">
                    {task.short.replaceAll('-', ' ')}
                  </small>
                </strong>
              </div>
              <div className="leader-metric">
                <span>
                  {rate === 0
                    ? '暂无成功记录'
                    : rate == null
                      ? '暂无成绩'
                      : isEgoVLA
                        ? '最佳 Unseen SR'
                        : '最佳成功率'}
                </span>
                <b>{pct(rate)}</b>
              </div>
              <div className="bar-track">
                <div style={{ width: `${(rate ?? 0) * 100}%` }} />
              </div>
              {rate != null && rate > 0 && (
                <ul
                  className="leader-models"
                  aria-label={`${task.label}领先模型及权重`}
                >
                  {winners.map((w) => {
                    const model = bench.models.find((m) => m.id === w.modelId)!;
                    const weight = displayStep(
                      w.actualStep,
                      bench.id,
                      model.policy,
                    );
                    return (
                      <li key={w.modelId} className="leader-model">
                        <div className="leader-model-heading">
                          <strong>
                            {warning(w.modelId) && '⚠️ '}
                            {model.label}
                          </strong>
                          <span
                            className="weight-badge"
                            title={`${w.actualStep.toLocaleString()} steps`}
                          >
                            {weight >= 10000
                              ? `${+(weight / 10000).toFixed(4)}万轮权重`
                              : `${weight.toLocaleString()}轮权重`}
                          </span>
                        </div>
                        {isEgoVLA && (
                          <small className="leader-seen">
                            Seen SR {pct(w.seen)}
                          </small>
                        )}
                        <small className="model-version">{model.name}</small>
                      </li>
                    );
                  })}
                </ul>
              )}
            </article>
          ))}
        </div>
      </section>
      <NoteDialog
        target={login ? null : target}
        close={() => setTarget(null)}
        notes={notes}
        onSaved={(note) =>
          setNotes((ns) => [...ns.filter((n) => n.key !== note.key), note])
        }
        authenticated={authenticated}
        onLogin={() => setLogin(true)}
      />
      <LoginDialog
        open={login}
        close={() => setLogin(false)}
        onSuccess={() => setAuthenticated(true)}
      />
      <footer id="method">
        <b>{bench.metric}</b>
        <p>
          {active === 'egovla'
            ? 'EgoVLA 按 eval web 的短程 7 项、长程 5 项分别展示 Seen 与 Unseen；每个模型权重按任务选择对应 split 的最佳完整测评，setting 内按 Mean SR 排名，PSR 作为同分比较。'
            : `SparkArena 总榜沿用评测 Web 的 ${bench.tasks.length} 项正式任务和目标回合数。`}{' '}
          {active === 'egovla'
            ? '每个任务仍按原始成绩保留 Seen / Unseen 两个指标，缺失值显示为 —。'
            : '同一模型、同一权重的各任务取最新完成的单次评测，再比较各权重的任务等权平均；整组均为零分时，逐层回退到更早记录，仍须任务齐全。'}{' '}
          单任务零成功率仍是有效成绩；缺失成绩显示为
          —。
        </p>
        <span>
          数据来自本次模型测评，不代表 benchmark 原作者发布的官方排行榜。
        </span>
      </footer>
    </main>
  );
}

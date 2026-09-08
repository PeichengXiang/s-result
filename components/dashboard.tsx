'use client';
import { useEffect, useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowUpRight,
  ChartNoAxesColumnIncreasing,
} from 'lucide-react';
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
import TaskTables from './task-tables';
import { LoginDialog, NoteDialog, type EditTarget } from './notes';
import { api, hostedOrigin, onGitHub, type Note } from '@/lib/notes-client';
import { data, ranking, leaders, pct, stepLabel } from '@/lib/results';

export default function Dashboard() {
  const [active, setActive] = useState('sparkarena');
  const [epoch, setEpoch] = useState('all'),
    [policy, setPolicy] = useState('all');
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
    if (!onGitHub())
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
    if (onGitHub()) {
      location.href = `${hostedOrigin}/?benchmark=${active}&edit=${encodeURIComponent(t.key)}`;
      return;
    }
    setTarget(t);
    if (!authenticated) setLogin(true);
  }
  function openLogin() {
    if (onGitHub()) {
      location.href = `${hostedOrigin}/?benchmark=${active}&login=1`;
      return;
    }
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
  const rows = useMemo(() => ranking(bench, epoch), [bench, epoch]);
  const wins = useMemo(() => leaders(bench, epoch), [bench, epoch]);
  const epochs = [...new Set(bench.records.map((r) => r.epoch))].sort(
    (a, b) => a - b,
  );
  const policies = [
    ...new Map(bench.models.map((m) => [m.policy, m.label])).entries(),
  ].sort((a, b) => a[1].localeCompare(b[1]));
  const warning = (modelId: string) =>
    notes.some((n) => n.abnormal && n.key.startsWith(`${active}:${modelId}`));
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
            setPolicy('all');
            await new Promise<void>((resolve) =>
              requestAnimationFrame(() => resolve()),
            );
            return {
              benchmark: b.name,
              epoch: v.epoch ?? 'all',
              models: ranking(
                b,
                v.epoch === undefined ? 'all' : String(v.epoch),
              ).map((r) => ({ name: r.model.label, successRate: r.rate })),
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
            公开成绩 · {data.updatedAt.slice(0, 10)}
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
          setPolicy('all');
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
                {epoch === 'all' ? '所有已完成权重' : stepLabel(Number(epoch))}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">所有已完成权重</SelectItem>
              {epochs.map((n) => (
                <SelectItem key={n} value={String(n)}>
                  {stepLabel(n)}
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
              <TableHead>平均成功率</TableHead>
              <TableHead>备注</TableHead>
              {bench.tasks.map((t) => (
                <TableHead key={t.id} className="task-column" title={t.source}>
                  <span>{t.label}</span>
                  <small className="task-english" lang="en">
                    {t.short.replaceAll('-', ' ')}
                  </small>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row, i) => (
              <TableRow
                key={row.model.id}
                className={warning(row.model.id) ? 'abnormal-row' : ''}
              >
                <TableCell>
                  <span className="rank">{String(i + 1).padStart(2, '0')}</span>
                  <strong>
                    {warning(row.model.id) && '⚠️ '}
                    {row.model.label}
                  </strong>
                  <small className="model-version">{row.model.name}</small>
                </TableCell>
                <TableCell>{stepLabel(row.epoch)}</TableCell>
                <TableCell className="average">{pct(row.rate)}</TableCell>
                <TableCell className="note-cell">
                  {notes
                    .filter(
                      (n) =>
                        n.key.startsWith(`${active}:${row.model.id}`) && n.text,
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
                  <TableCell key={j}>{pct(c?.rate)}</TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <p className="table-hint">
          每种模型选择全任务平均最高的同一权重；各任务等权平均。
        </p>
      </section>
      {!rows.length && (
        <div className="empty-state">
          当前权重尚无覆盖全部 {bench.tasks.length}{' '}
          个任务的模型，可在下方查看已完成任务成绩。
        </div>
      )}
      <div className="details-filter">
        <label>
          分表模型{' '}
          <Select value={policy} onValueChange={(v) => setPolicy(String(v))}>
            <SelectTrigger aria-label="分表模型">
              <SelectValue>
                {policy === 'all'
                  ? '全部模型'
                  : policies.find((p) => p[0] === policy)?.[1]}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部模型</SelectItem>
              {policies.map(([key, name]) => (
                <SelectItem key={key} value={key}>
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
      </div>
      <TaskTables
        bench={bench}
        epoch={epoch}
        policy={policy}
        notes={notes}
        edit={edit}
      />
      <section className="leader-section">
        <div className="section-head">
          <h2>各任务，谁在领先</h2>
          <span>单任务最佳成功率 · 可来自不同权重</span>
        </div>
        <div className="leaders-grid">
          {wins.map(({ task, rate, winners }, i) => (
            <a key={task.id} href={`#task-${task.id}`} className="leader-item">
              <div className="leader-top">
                <span className="index">{String(i + 1).padStart(2, '0')}</span>
                <strong title={task.source}>
                  {task.label}
                  <small className="task-english" lang="en">
                    {task.short.replaceAll('-', ' ')}
                  </small>
                </strong>
                <ArrowUpRight size={15} />
              </div>
              <div className="leader-metric">
                <span>
                  {rate === 0
                    ? '暂无成功记录'
                    : winners
                        .slice(0, 2)
                        .map(
                          (w) =>
                            (warning(w.modelId) ? '⚠️ ' : '') +
                            bench.models.find((m) => m.id === w.modelId)?.label,
                        )
                        .join(' / ') || '暂无成绩'}
                </span>
                <b>{pct(rate)}</b>
              </div>
              <div className="bar-track">
                <div style={{ width: `${(rate ?? 0) * 100}%` }} />
              </div>
            </a>
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
            ? '排名使用 Unseen 66 回合成功率，Seen 27 单独报告，93 回合用于判断测评是否完成。'
            : 'SparkArena 总榜沿用评测 Web 的 5 项正式任务和目标回合数。'}{' '}
          同权重重复测评优先选完整轮次中平均成功率最高的一次，否则逐任务选择最佳完整单次。零成功率是有效成绩；缺失成绩显示为
          —。
        </p>
        <span>
          数据来自本次模型测评，不代表 benchmark 原作者发布的官方排行榜。
        </span>
      </footer>
    </main>
  );
}

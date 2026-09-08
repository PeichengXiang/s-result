'use client';
import { useState } from 'react';
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { pct, stepLabel, better, type Benchmark } from '@/lib/results';
import type { Note } from '@/lib/notes-client';
import type { EditTarget } from './notes';
export default function TaskTables({
  bench,
  epoch,
  policy,
  notes,
  edit,
}: {
  bench: Benchmark;
  epoch: string;
  policy: string;
  notes: Note[];
  edit: (target: EditTarget) => void;
}) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  return (
    <section className="table-section" id="details">
      <div className="section-head">
        <div>
          <p className="eyebrow">02 / TASK DETAILS</p>
          <h2>各任务成绩</h2>
        </div>
        <span>全部已完成权重 · 保留每次测评</span>
      </div>
      {bench.tasks.map((task, i) => {
        const all = bench.records
          .filter(
            (p) =>
              p.taskId === task.id &&
              (epoch === 'all' || p.epoch === Number(epoch)) &&
              (policy === 'all' ||
                bench.models.find((m) => m.id === p.modelId)?.policy ===
                  policy),
          )
          .sort(better);
        const visible = expanded[task.id] ? all : all.slice(0, 8);
        return (
          <article key={task.id} id={`task-${task.id}`} className="task-block">
            <div className="section-head">
              <h3>
                <span className="index">{String(i + 1).padStart(2, '0')}</span>{' '}
                {task.label}{' '}
                <small lang="en" title={task.source}>
                  {task.short.replaceAll('-', ' ')}
                </small>
              </h3>
              <span>{all.length} 条完成记录</span>
            </div>
            {all.length ? (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>模型 / 版本</TableHead>
                      <TableHead>权重</TableHead>
                      <TableHead>{bench.metric}</TableHead>
                      {bench.id === 'egovla' && <TableHead>Seen SR</TableHead>}
                      <TableHead>Score</TableHead>
                      <TableHead>回合</TableHead>
                      <TableHead>备注</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visible.map((r) => {
                      const model = bench.models.find(
                        (m) => m.id === r.modelId,
                      )!;
                      const key = `${bench.id}:${r.modelId}:${r.taskId}:${r.epoch}`;
                      const ns = notes.filter(
                        (n) =>
                          n.key === key || n.key === `${bench.id}:${r.modelId}`,
                      );
                      const abnormal = ns.some((n) => n.abnormal);
                      return (
                        <TableRow
                          key={r.id}
                          className={abnormal ? 'abnormal-row' : ''}
                        >
                          <TableCell>
                            <strong>
                              {abnormal && <span title="已标记异常">⚠️ </span>}
                              {model.label}
                            </strong>
                            <small className="model-version">
                              {model.name}
                            </small>
                          </TableCell>
                          <TableCell>
                            {stepLabel(r.epoch)}
                            {r.actualStep !== r.epoch && (
                              <small className="model-version">
                                实际 {r.actualStep.toLocaleString()}
                              </small>
                            )}
                          </TableCell>
                          <TableCell
                            className={
                              r.rate === all[0].rate ? 'best-cell' : ''
                            }
                          >
                            {pct(r.rate)}
                          </TableCell>
                          {bench.id === 'egovla' && (
                            <TableCell>{pct(r.seen)}</TableCell>
                          )}
                          <TableCell>{r.score?.toFixed(1) ?? '—'}</TableCell>
                          <TableCell>{r.rollouts}</TableCell>
                          <TableCell className="note-cell">
                            {ns
                              .filter((n) => n.text)
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
                                  key,
                                  title: `${model.label} · ${task.label} / ${task.short.replaceAll('-', ' ')} · ${stepLabel(r.epoch)}`,
                                })
                              }
                            >
                              {ns.some((n) => n.text)
                                ? '编辑备注'
                                : '＋ 添加备注'}
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
                {all.length > 8 && (
                  <Button
                    className="expand-button"
                    variant="ghost"
                    onClick={() =>
                      setExpanded((s) => ({ ...s, [task.id]: !s[task.id] }))
                    }
                  >
                    {expanded[task.id]
                      ? '收起'
                      : `展开全部 ${all.length} 条记录`}
                  </Button>
                )}
              </>
            ) : (
              <div className="empty-state">
                当前筛选下暂无已完成的测评记录。
              </div>
            )}
          </article>
        );
      })}
    </section>
  );
}

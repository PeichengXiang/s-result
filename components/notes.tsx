'use client';
import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { api, type Note } from '@/lib/notes-client';
export type EditTarget = { key: string; title: string };
export function NoteDialog({
  target,
  close,
  notes,
  onSaved,
  authenticated,
  onLogin,
}: {
  target: EditTarget | null;
  close: () => void;
  notes: Note[];
  onSaved: (note: Note) => void;
  authenticated: boolean;
  onLogin: () => void;
}) {
  const note = notes.find((n) => n.key === target?.key);
  const [text, setText] = useState(''),
    [abnormal, setAbnormal] = useState(false),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    if (target) {
      setText(note?.text ?? '');
      setAbnormal(!!note?.abnormal);
      setError('');
    }
  }, [target, note]);
  async function save() {
    setBusy(true);
    setError('');
    try {
      const { note: saved } = await api('notes', 'PUT', {
        key: target!.key,
        text,
        abnormal,
        version: note?.version ?? 0,
      });
      onSaved(saved);
      close();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog
      open={!!target}
      onOpenChange={(v) => {
        if (!v && !busy) close();
      }}
    >
      <DialogContent className="note-dialog">
        <DialogTitle>{target?.title}</DialogTitle>
        <DialogDescription>
          备注和异常提示对所有访客可见。清空文字并取消异常标记，可移除当前备注。
        </DialogDescription>
        {authenticated ? (
          <>
            <label htmlFor="note-text">备注</label>
            <Textarea
              id="note-text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={2000}
              rows={5}
              placeholder="记录测评现象、已知问题或结果说明"
            />
            <label className="checkbox-label">
              <Checkbox
                checked={abnormal}
                onCheckedChange={(v) => setAbnormal(v === true)}
              />
              ⚠️ 标记异常，重点提示此模型
            </label>
            {note && (
              <p className="meta">
                {note.author} ·{' '}
                {new Date(note.updated_at).toLocaleString('zh-CN')}
              </p>
            )}
            <p className="error" role="alert">
              {error}
            </p>
            <Button disabled={busy} onClick={save}>
              {busy ? '正在保存…' : '保存备注'}
            </Button>
          </>
        ) : (
          <>
            <p>请登录后添加或修改备注。</p>
            <Button onClick={onLogin}>管理员登录</Button>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
export function LoginDialog({
  open,
  close,
  onSuccess,
}: {
  open: boolean;
  close: () => void;
  onSuccess: () => void;
}) {
  const [username, setUsername] = useState(''),
    [password, setPassword] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api('session', 'POST', { username, password });
      setPassword('');
      onSuccess();
      close();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v && !busy) {
          close();
          setPassword('');
        }
      }}
    >
      <DialogContent className="note-dialog">
        <DialogTitle>管理员登录</DialogTitle>
        <DialogDescription>
          查看成绩无需登录。登录后可添加备注、标记和解除异常。
        </DialogDescription>
        <form className="login-form" onSubmit={submit}>
          <label htmlFor="username">姓名</label>
          <Input
            id="username"
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
          <label htmlFor="password">密码</label>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <p className="error" role="alert">
            {error}
          </p>
          <Button type="submit" disabled={busy}>
            {busy ? '登录中…' : '登录'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

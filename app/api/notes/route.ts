import { authenticated, body, cors, db, json, sameOrigin } from '@/lib/server';
export const dynamic = 'force-dynamic';
const noteKey = /^(sparkarena|egovla):[0-9a-f]{16}(?::[0-9a-f]{16}:[0-9]+)?$/i;
const reply = (
  req: Request,
  value: unknown,
  status = 200,
  extra: Record<string, string> = {},
) => json(value, status, { ...cors(req), ...extra });
export function OPTIONS(req: Request) {
  return new Response(null, { status: 204, headers: cors(req) });
}
export async function GET(req: Request) {
  try {
    const { results } = await db()
      .prepare('SELECT key,text,abnormal,version,updated_at,author FROM notes')
      .all();
    return reply(req, { notes: results });
  } catch {
    return reply(req, { error: '备注暂时无法加载，成绩仍可查看' }, 503);
  }
}
export async function PUT(req: Request) {
  if (!sameOrigin(req)) return reply(req, { error: '请求来源不匹配' }, 403);
  try {
    if (!(await authenticated(req))) return reply(req, { error: '请先登录' }, 401);
    const input = await body(req);
    if (
      typeof input.key !== 'string' ||
      !noteKey.test(input.key) ||
      typeof input.text !== 'string' ||
      input.text.length > 2000 ||
      typeof input.abnormal !== 'boolean' ||
      !Number.isSafeInteger(input.version) ||
      input.version < 0
    )
      return reply(req, { error: '备注内容不正确' }, 400);
    if (input.abnormal && !input.text.trim())
      return reply(req, { error: '请填写异常原因' }, 400);
    const now = new Date().toISOString();
    const result =
      input.version === 0
        ? await db()
            .prepare(
              'INSERT INTO notes(key,text,abnormal,version,updated_at,author) VALUES(?,?,?,1,?,?) ON CONFLICT(key) DO NOTHING',
            )
            .bind(
              input.key,
              input.text.trim(),
              Number(input.abnormal),
              now,
              'xiangpc',
            )
            .run()
        : await db()
            .prepare(
              'UPDATE notes SET text=?,abnormal=?,version=version+1,updated_at=?,author=? WHERE key=? AND version=?',
            )
            .bind(
              input.text.trim(),
              Number(input.abnormal),
              now,
              'xiangpc',
              input.key,
              input.version,
            )
            .run();
    if (result.meta.changes !== 1)
      return reply(req, { error: '备注已被更新，请重新打开后再保存' }, 409);
    return reply(req, {
      note: await db()
        .prepare(
          'SELECT key,text,abnormal,version,updated_at,author FROM notes WHERE key=?',
        )
        .bind(input.key)
        .first(),
    });
  } catch {
    return reply(req, { error: '备注未保存，请稍后重试' }, 503);
  }
}

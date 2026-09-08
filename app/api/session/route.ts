import {
  authenticated,
  bindings,
  body,
  cookie,
  db,
  json,
  passwordHash,
  safeEqual,
  sameOrigin,
  sessionHash,
  sha,
} from '@/lib/server';
export const dynamic = 'force-dynamic';
export async function GET(req: Request) {
  try {
    return json({ authenticated: await authenticated(req) });
  } catch {
    return json({ error: '登录服务暂不可用' }, 503);
  }
}
export async function POST(req: Request) {
  if (!sameOrigin(req)) return json({ error: '请求来源不匹配' }, 403);
  try {
    const env = bindings();
    if (!env.ADMIN_USER || !env.ADMIN_PASSWORD_HASH || !env.ADMIN_PASSWORD_SALT)
      return json({ error: '管理员登录尚未配置' }, 503);
    const input = await body(req);
    if (
      typeof input.username !== 'string' ||
      typeof input.password !== 'string' ||
      input.password.length > 256
    )
      return json({ error: '请输入姓名和密码' }, 400);
    const now = Date.now(),
      ip = req.headers.get('cf-connecting-ip') ?? 'local',
      key = await sha(ip + ':' + Math.floor(now / 600000));
    await db().batch([
      db().prepare('DELETE FROM auth_attempts WHERE expires<?').bind(now),
      db()
        .prepare(
          'INSERT INTO auth_attempts(key,count,expires) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1',
        )
        .bind(key, now + 600000),
    ]);
    const attempts = await db()
      .prepare('SELECT count FROM auth_attempts WHERE key=?')
      .bind(key)
      .first<{ count: number }>();
    if ((attempts?.count ?? 0) > 10)
      return json({ error: '尝试次数过多，请稍后重试' }, 429);
    if (
      !safeEqual(input.username, env.ADMIN_USER) ||
      !safeEqual(
        await passwordHash(input.password, env.ADMIN_PASSWORD_SALT),
        env.ADMIN_PASSWORD_HASH,
      )
    )
      return json({ error: '姓名或密码不正确' }, 401);
    const token = Array.from(crypto.getRandomValues(new Uint8Array(32)), (v) =>
      v.toString(16).padStart(2, '0'),
    ).join('');
    const old = await sessionHash(req);
    await db().batch([
      db()
        .prepare('DELETE FROM sessions WHERE expires<? OR hash=?')
        .bind(now, old ?? ''),
      db()
        .prepare('INSERT INTO sessions(hash,expires) VALUES(?,?)')
        .bind(await sha(token), now + 8 * 3600000),
      db().prepare('DELETE FROM auth_attempts WHERE key=?').bind(key),
    ]);
    return json({ authenticated: true }, 200, {
      'Set-Cookie': cookie(req, token, 28800),
    });
  } catch {
    return json({ error: '暂时无法登录，请稍后重试' }, 503);
  }
}
export async function DELETE(req: Request) {
  if (!sameOrigin(req)) return json({ error: '请求来源不匹配' }, 403);
  try {
    const hash = await sessionHash(req);
    if (hash)
      await db().prepare('DELETE FROM sessions WHERE hash=?').bind(hash).run();
    return json({ authenticated: false }, 200, {
      'Set-Cookie': cookie(req, '', 0),
    });
  } catch {
    return json({ error: '退出失败，请重试' }, 503);
  }
}

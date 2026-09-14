const { sql } = require('./db');
const { randomToken, sha256 } = require('./crypto');
const { parseCookies, setCookie, clearCookie } = require('./cookies');

const SESSION_COOKIE = 'kabinet_session';
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 60; // 60 дней с продлением при активности

// Постоянная персональная ссылка используется, чтобы создать обычную
// серверную сессию (HttpOnly cookie) — дальше участник просто открывает
// сайт в этом браузере, ссылку заново вводить не нужно (см. план, раздел
// про авторизацию и trade-off постоянной ссылки).
async function createSession(res, userId) {
  const token = randomToken(32);
  const tokenHash = sha256(token);
  const expiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000);
  await sql`
    INSERT INTO sessions (user_id, session_token_hash, expires_at)
    VALUES (${userId}, ${tokenHash}, ${expiresAt.toISOString()})
  `;
  setCookie(res, SESSION_COOKIE, token, { maxAge: SESSION_TTL_SECONDS });
  return token;
}

async function destroySession(req, res) {
  const cookies = parseCookies(req);
  const token = cookies[SESSION_COOKIE];
  if (token) {
    const tokenHash = sha256(token);
    await sql`DELETE FROM sessions WHERE session_token_hash = ${tokenHash}`;
  }
  clearCookie(res, SESSION_COOKIE);
}

async function getSessionUser(req) {
  const cookies = parseCookies(req);
  const token = cookies[SESSION_COOKIE];
  if (!token) return null;

  const tokenHash = sha256(token);
  const { rows } = await sql`
    SELECT u.id, u.name, u.email, u.status, u.role, u.level_id
    FROM sessions s
    JOIN users u ON u.id = s.user_id
    WHERE s.session_token_hash = ${tokenHash} AND s.expires_at > now()
  `;
  if (!rows[0]) return null;

  // Продлеваем "последнюю активность" не блокируя ответ.
  sql`UPDATE sessions SET last_seen_at = now() WHERE session_token_hash = ${tokenHash}`.catch(
    (err) => console.error('session touch error', err)
  );

  return rows[0];
}

async function requireUser(req, res) {
  const user = await getSessionUser(req);
  if (!user || user.status !== 'active') {
    res.status(401).json({ error: 'unauthorized' });
    return null;
  }
  return user;
}

async function requireAdmin(req, res) {
  const user = await requireUser(req, res);
  if (!user) return null;
  if (user.role !== 'admin') {
    res.status(403).json({ error: 'forbidden' });
    return null;
  }
  return user;
}

module.exports = {
  createSession,
  destroySession,
  getSessionUser,
  requireUser,
  requireAdmin,
  SESSION_COOKIE,
};

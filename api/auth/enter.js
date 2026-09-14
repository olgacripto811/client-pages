const { sql } = require('../_lib/db');
const { sha256 } = require('../_lib/crypto');
const { createSession } = require('../_lib/auth');
const { checkRateLimit, clientIp } = require('../_lib/ratelimit');

// GET /api/auth/enter?token=... — вход по постоянной персональной ссылке.
// Ссылка не истекает сама (в отличие от обычной magic-link); создаёт
// обычную серверную сессию и дальше используется браузерная cookie.
module.exports = async (req, res) => {
  if (req.method !== 'GET') return res.status(405).json({ error: 'method_not_allowed' });

  const ok = await checkRateLimit(`enter:${clientIp(req)}`, { limit: 20, windowSeconds: 600 });
  if (!ok) return res.redirect(302, '/kabinet-vhod.html?error=rate_limited');

  const token = (req.query?.token || '').toString().trim();
  if (!token) return res.redirect(302, '/kabinet-vhod.html?error=missing_token');

  const tokenHash = sha256(token);
  const { rows } = await sql`
    SELECT id, status FROM users WHERE access_token_hash = ${tokenHash}
  `;
  const user = rows[0];

  if (!user || user.status !== 'active') {
    return res.redirect(302, '/kabinet-vhod.html?error=invalid_token');
  }

  await createSession(res, user.id);
  return res.redirect(302, '/kabinet-glavnaya.html');
};

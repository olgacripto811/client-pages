const { sql } = require('../_lib/db');
const { randomToken, sha256 } = require('../_lib/crypto');
const { requireUser } = require('../_lib/auth');

// POST /api/auth/reissue-link — самообслуживание: если участник считает,
// что его персональная ссылка могла кому-то попасться на глаза, он может
// мгновенно инвалидировать старую и получить новую. Требует активную сессию
// (то есть уже выполненный вход по старой ссылке).
module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });

  const user = await requireUser(req, res);
  if (!user) return;

  const token = randomToken(32);
  const tokenHash = sha256(token);

  await sql`
    UPDATE users
    SET access_token_hash = ${tokenHash}, access_token_version = access_token_version + 1
    WHERE id = ${user.id}
  `;

  const origin = `https://${req.headers.host}`;
  return res.status(200).json({ link: `${origin}/api/auth/enter?token=${token}` });
};

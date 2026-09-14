const { sql } = require('../../../_lib/db');
const { randomToken, sha256 } = require('../../../_lib/crypto');
const { requireAdmin } = require('../../../_lib/auth');

// POST /api/admin/users/:id/approve — одобряет заявку (pending → active),
// генерирует постоянную персональную ссылку и возвращает её для показа в
// админке (Ольга передаёт её участнику лично — отправка на email не входит
// в v1, см. план).
module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });

  const admin = await requireAdmin(req, res);
  if (!admin) return;

  const { id } = req.query;
  const token = randomToken(32);
  const tokenHash = sha256(token);

  const { rows } = await sql`
    UPDATE users
    SET status = 'active', approved_at = now(),
        access_token_hash = ${tokenHash}, access_token_version = access_token_version + 1
    WHERE id = ${id} AND status <> 'active'
    RETURNING id, email, first_name, last_name
  `;

  if (!rows[0]) return res.status(404).json({ error: 'not_found_or_already_active' });

  const origin = `https://${req.headers.host}`;
  const link = `${origin}/api/auth/enter?token=${token}`;

  return res.status(200).json({ ok: true, link, user: rows[0] });
};

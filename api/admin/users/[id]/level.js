const { sql } = require('../../../_lib/db');
const { requireAdmin } = require('../../../_lib/auth');

// POST /api/admin/users/:id/level — назначить участнику уровень/тариф
// (от него зависит ставка USDT за отмеченный сигнал).
module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });

  const admin = await requireAdmin(req, res);
  if (!admin) return;

  const { id } = req.query;
  const { level_id } = req.body || {};

  await sql`UPDATE users SET level_id = ${level_id || null} WHERE id = ${id}`;
  return res.status(200).json({ ok: true });
};

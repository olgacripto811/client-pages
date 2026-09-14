const { sql } = require('../_lib/db');
const { requireAdmin } = require('../_lib/auth');

// GET /api/admin/levels — список уровней/тарифов.
// POST /api/admin/levels — создать уровень {name, rate_usdt_per_signal}.
module.exports = async (req, res) => {
  const admin = await requireAdmin(req, res);
  if (!admin) return;

  if (req.method === 'GET') {
    const { rows } = await sql`
      SELECT id, name, rate_usdt_per_signal, created_at
      FROM membership_levels ORDER BY created_at
    `;
    return res.status(200).json({ levels: rows });
  }

  if (req.method === 'POST') {
    const { name, rate_usdt_per_signal } = req.body || {};
    if (!name || rate_usdt_per_signal == null) {
      return res.status(400).json({ error: 'invalid_input' });
    }
    const { rows } = await sql`
      INSERT INTO membership_levels (name, rate_usdt_per_signal)
      VALUES (${name}, ${rate_usdt_per_signal})
      RETURNING id, name, rate_usdt_per_signal
    `;
    return res.status(200).json({ level: rows[0] });
  }

  return res.status(405).json({ error: 'method_not_allowed' });
};

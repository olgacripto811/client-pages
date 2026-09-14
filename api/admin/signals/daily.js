const { sql } = require('../../_lib/db');
const { requireAdmin } = require('../../_lib/auth');

// GET /api/admin/signals/daily?date=YYYY-MM-DD — коды, уже введённые на дату
// (для админки — видно, что уже отправлено, а что ещё нет).
// POST /api/admin/signals/daily {slot_id, date, code} — ввести/обновить код
// сигнала на дату (Ольга).
module.exports = async (req, res) => {
  const admin = await requireAdmin(req, res);
  if (!admin) return;

  if (req.method === 'GET') {
    const date = (req.query.date || new Date().toISOString().slice(0, 10)).toString();
    const { rows } = await sql`
      SELECT ds.slot_id, s.name AS slot_name, ds.id, ds.code, ds.published_at
      FROM signal_slots s
      LEFT JOIN daily_signals ds ON ds.slot_id = s.id AND ds.date = ${date}
      WHERE s.is_active
      ORDER BY s.name
    `;
    return res.status(200).json({ date, items: rows });
  }

  if (req.method === 'POST') {
    const { slot_id, date, code } = req.body || {};
    if (!slot_id || !date || !code) return res.status(400).json({ error: 'invalid_input' });

    const { rows } = await sql`
      INSERT INTO daily_signals (slot_id, date, code, published_at, created_by)
      VALUES (${slot_id}, ${date}, ${code}, now(), ${admin.id})
      ON CONFLICT (slot_id, date)
      DO UPDATE SET code = EXCLUDED.code, published_at = now(), created_by = EXCLUDED.created_by
      RETURNING id, slot_id, date, code, published_at
    `;
    return res.status(200).json({ signal: rows[0] });
  }

  return res.status(405).json({ error: 'method_not_allowed' });
};

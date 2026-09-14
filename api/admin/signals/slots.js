const { sql } = require('../../_lib/db');
const { requireAdmin } = require('../../_lib/auth');

// GET /api/admin/signals/slots — список слотов/каналов сигналов.
// POST /api/admin/signals/slots — создать слот {name, requires_leader?, schedule?}.
// `requires_leader` — слот виден только участникам с is_leader=true
// (независимо от уровня), например слот 20:30.
// `schedule` — гибкий jsonb, расписание пришлют позже, можно оставлять пустым.
module.exports = async (req, res) => {
  const admin = await requireAdmin(req, res);
  if (!admin) return;

  if (req.method === 'GET') {
    const { rows } = await sql`
      SELECT id, name, schedule, requires_leader, is_active, created_at
      FROM signal_slots ORDER BY created_at
    `;
    return res.status(200).json({ slots: rows });
  }

  if (req.method === 'POST') {
    const { name, schedule, requires_leader } = req.body || {};
    if (!name) return res.status(400).json({ error: 'invalid_input' });

    const { rows } = await sql`
      INSERT INTO signal_slots (name, schedule, requires_leader)
      VALUES (${name}, ${JSON.stringify(schedule || {})}::jsonb, ${!!requires_leader})
      RETURNING id, name, schedule, requires_leader, is_active
    `;
    return res.status(200).json({ slot: rows[0] });
  }

  return res.status(405).json({ error: 'method_not_allowed' });
};

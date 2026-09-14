const { sql } = require('../../_lib/db');
const { requireUser } = require('../../_lib/auth');

// POST /api/signals/:id/ack — отметить сигнал как "увидел/ознакомился".
// :id — daily_signal_id. Идемпотентно (повторный вызов не ломает acked_at).
module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });

  const user = await requireUser(req, res);
  if (!user) return;

  const { id } = req.query;

  // Отмечать можно только сигнал, доступный этому участнику через слоты
  // его уровня или (для лидерских слотов) его лидерский статус.
  const { rows: accessRows } = await sql`
    SELECT ds.id
    FROM daily_signals ds
    JOIN signal_slots s
      ON s.id = ds.slot_id
      AND s.is_active
      AND (
        s.id IN (SELECT slot_id FROM level_signal_access WHERE level_id = ${user.level_id})
        OR (s.requires_leader AND ${!!user.is_leader})
      )
    WHERE ds.id = ${id}
  `;
  if (!accessRows[0]) return res.status(404).json({ error: 'not_found' });

  const { rows } = await sql`
    INSERT INTO user_signal_ack (user_id, daily_signal_id)
    VALUES (${user.id}, ${id})
    ON CONFLICT (user_id, daily_signal_id) DO UPDATE SET acked_at = user_signal_ack.acked_at
    RETURNING acked_at
  `;

  return res.status(200).json({ acked: true, acked_at: rows[0].acked_at });
};

const { sql } = require('./db');

// Общая выборка "какие сигналы были доступны участнику и какие он отметил"
// — переиспользуется и статистикой по сигналам (/api/signals/history), и
// статистикой по заработку (/api/earnings/history), чтобы не дублировать SQL.
// Доступ определяется уровнем участника (level_signal_access) + лидерским
// бонусом (слоты с requires_leader=true), см. api/signals/today.js.
async function fetchUserSignalHistory(userId, from, to) {
  const { rows } = await sql`
    SELECT ds.date, s.name AS slot_name, ds.code, ack.acked_at
    FROM users u
    JOIN signal_slots s
      ON s.is_active
      AND (
        s.id IN (SELECT slot_id FROM level_signal_access WHERE level_id = u.level_id)
        OR (s.requires_leader AND u.is_leader)
      )
    JOIN daily_signals ds ON ds.slot_id = s.id AND ds.date BETWEEN ${from} AND ${to}
    LEFT JOIN user_signal_ack ack ON ack.daily_signal_id = ds.id AND ack.user_id = ${userId}
    WHERE u.id = ${userId}
    ORDER BY ds.date DESC, s.name
  `;
  return rows.map((r) => ({ date: r.date, slot_name: r.slot_name, acked: !!r.acked_at }));
}

module.exports = { fetchUserSignalHistory };

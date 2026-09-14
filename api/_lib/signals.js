const { sql } = require('./db');

// Общая выборка "какие сигналы были доступны участнику и какие он отметил"
// — переиспользуется и статистикой по сигналам (/api/signals/history), и
// статистикой по заработку (/api/earnings/history), чтобы не дублировать SQL.
async function fetchUserSignalHistory(userId, from, to) {
  const { rows } = await sql`
    SELECT ds.date, s.name AS slot_name, ds.code, ack.acked_at
    FROM user_signal_access uas
    JOIN signal_slots s ON s.id = uas.slot_id
    JOIN daily_signals ds ON ds.slot_id = s.id AND ds.date BETWEEN ${from} AND ${to}
    LEFT JOIN user_signal_ack ack ON ack.daily_signal_id = ds.id AND ack.user_id = ${userId}
    WHERE uas.user_id = ${userId}
    ORDER BY ds.date DESC, s.name
  `;
  return rows.map((r) => ({ date: r.date, slot_name: r.slot_name, acked: !!r.acked_at }));
}

module.exports = { fetchUserSignalHistory };

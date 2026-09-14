const { sql } = require('../_lib/db');
const { requireUser } = require('../_lib/auth');

// GET /api/signals/today — доступные пользователю слоты с сегодняшним
// кодом (если Ольга уже ввела) и отметкой "увидел".
module.exports = async (req, res) => {
  if (req.method !== 'GET') return res.status(405).json({ error: 'method_not_allowed' });

  const user = await requireUser(req, res);
  if (!user) return;

  const { rows } = await sql`
    SELECT s.id AS slot_id, s.name AS slot_name,
           ds.id AS daily_signal_id, ds.code, ds.published_at,
           ack.acked_at
    FROM user_signal_access uas
    JOIN signal_slots s ON s.id = uas.slot_id AND s.is_active
    LEFT JOIN daily_signals ds ON ds.slot_id = s.id AND ds.date = CURRENT_DATE
    LEFT JOIN user_signal_ack ack ON ack.daily_signal_id = ds.id AND ack.user_id = ${user.id}
    WHERE uas.user_id = ${user.id}
    ORDER BY s.name
  `;

  // Выходные биржи — пятница и суббота. Точный часовой пояс биржи уточним,
  // когда придёт расписание (SignalSlots.schedule); пока ориентируемся на UTC.
  const utcDay = new Date().getUTCDay(); // 0=Вс,1=Пн,...,5=Пт,6=Сб
  const isWeekend = utcDay === 5 || utcDay === 6;

  return res.status(200).json({
    is_weekend: isWeekend,
    slots: rows.map((r) => ({
      slot_id: r.slot_id,
      slot_name: r.slot_name,
      daily_signal_id: r.daily_signal_id,
      code: r.code,
      published_at: r.published_at,
      acked: !!r.acked_at,
    })),
  });
};

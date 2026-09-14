const { sql } = require('../_lib/db');
const { requireUser } = require('../_lib/auth');

// GET /api/signals/today — сигналы, доступные пользователю сегодня: слоты
// его уровня (level_signal_access) + слоты с requires_leader=true, если он
// лидер (независимо от уровня). Для каждого — код на сегодня (если Ольга
// уже ввела), время истечения и отметка "увидел".
module.exports = async (req, res) => {
  if (req.method !== 'GET') return res.status(405).json({ error: 'method_not_allowed' });

  const user = await requireUser(req, res);
  if (!user) return;

  const { rows } = await sql`
    SELECT s.id AS slot_id, s.name AS slot_name,
           ds.id AS daily_signal_id, ds.code, ds.published_at, ds.expires_at,
           ack.acked_at
    FROM signal_slots s
    LEFT JOIN daily_signals ds ON ds.slot_id = s.id AND ds.date = CURRENT_DATE
    LEFT JOIN user_signal_ack ack ON ack.daily_signal_id = ds.id AND ack.user_id = ${user.id}
    WHERE s.is_active
      AND (
        s.id IN (SELECT slot_id FROM level_signal_access WHERE level_id = ${user.level_id})
        OR (s.requires_leader AND ${!!user.is_leader})
      )
    ORDER BY s.name
  `;

  // Выходные биржи — пятница и суббота. Точный часовой пояс биржи уточним,
  // когда придёт формальное расписание; пока ориентируемся на UTC.
  const utcDay = new Date().getUTCDay(); // 0=Вс,1=Пн,...,5=Пт,6=Сб
  const isWeekend = utcDay === 5 || utcDay === 6;

  return res.status(200).json({
    is_weekend: isWeekend,
    slots: rows.map((r) => {
      const expiresAt = r.expires_at ? new Date(r.expires_at) : null;
      return {
        slot_id: r.slot_id,
        slot_name: r.slot_name,
        daily_signal_id: r.daily_signal_id,
        code: r.code,
        published_at: r.published_at,
        expires_at: r.expires_at,
        is_expired: !!expiresAt && expiresAt.getTime() < Date.now(),
        acked: !!r.acked_at,
      };
    }),
  });
};

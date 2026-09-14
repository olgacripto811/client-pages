const { sql } = require('./db');

// Формула (см. план, раздел 1): доступно к выводу =
//   (кол-во отмеченных сигналов с прошлого вывода)
//   × ставка_usdt_за_сигнал (по уровню участника)
//   × (1 − комиссия_на_вывод / 100),
// показывается в USDT и в рублях по текущему курсу.
//
// `queryFn(text, params)` — по умолчанию обычный запрос через `sql.query`;
// при создании вывода (api/withdrawals/index.js) передаётся клиент активной
// транзакции, чтобы расчёт и запись снапшота были атомарны и защищены
// advisory-локом от двойного вывода при параллельных запросах.
async function computeCurrentPeriod(userId, queryFn) {
  const query = queryFn || ((text, params) => sql.query(text, params));

  const userRes = await query(
    `SELECT u.created_at, l.rate_usdt_per_signal
     FROM users u
     LEFT JOIN membership_levels l ON l.id = u.level_id
     WHERE u.id = $1`,
    [userId]
  );
  const user = userRes.rows[0];
  if (!user) return null;

  const lastRes = await query(
    `SELECT period_end FROM withdrawal_ledger
     WHERE user_id = $1
     ORDER BY period_end DESC LIMIT 1`,
    [userId]
  );
  const periodStart = lastRes.rows[0]?.period_end || user.created_at;

  const countRes = await query(
    `SELECT count(*)::int AS c FROM user_signal_ack
     WHERE user_id = $1 AND acked_at > $2`,
    [userId, periodStart]
  );
  const signalsCount = countRes.rows[0]?.c || 0;

  const settingsRes = await query(
    `SELECT usdt_rub_rate, withdrawal_commission_pct FROM settings WHERE id = true`,
    []
  );
  const settings = settingsRes.rows[0];

  const rate = Number(user.rate_usdt_per_signal || 0);
  const grossUsdt = signalsCount * rate;
  const commissionPct = Number(settings.withdrawal_commission_pct);
  const netUsdt = grossUsdt * (1 - commissionPct / 100);
  const usdtRubRate = Number(settings.usdt_rub_rate);
  const netRub = netUsdt * usdtRubRate;

  return {
    periodStart,
    signalsCount,
    rate,
    grossUsdt,
    commissionPct,
    netUsdt,
    usdtRubRate,
    netRub,
  };
}

module.exports = { computeCurrentPeriod };

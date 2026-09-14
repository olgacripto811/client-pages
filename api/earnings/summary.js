const { sql } = require('../_lib/db');
const { requireUser } = require('../_lib/auth');
const { computeCurrentPeriod } = require('../_lib/earnings');

// GET /api/earnings/summary — текущий незакрытый период (сколько отмечено
// с прошлого вывода → сколько доступно к выводу сейчас), плюс сумма за всё
// время. Формула — см. api/_lib/earnings.js.
module.exports = async (req, res) => {
  if (req.method !== 'GET') return res.status(405).json({ error: 'method_not_allowed' });

  const user = await requireUser(req, res);
  if (!user) return;

  const period = await computeCurrentPeriod(user.id);
  if (!period) return res.status(404).json({ error: 'not_found' });

  const { rows: totalsRows } = await sql`
    SELECT coalesce(sum(gross_usdt), 0) AS gross_total, coalesce(sum(net_usdt), 0) AS net_total
    FROM withdrawal_ledger WHERE user_id = ${user.id}
  `;
  const totals = totalsRows[0];

  return res.status(200).json({
    signals_count: period.signalsCount,
    rate_usdt_per_signal: period.rate,
    gross_usdt: period.grossUsdt,
    commission_pct: period.commissionPct,
    net_usdt: period.netUsdt,
    usdt_rub_rate: period.usdtRubRate,
    net_rub: period.netRub,
    earned_total_usdt: Number(totals.gross_total) + period.grossUsdt,
    withdrawn_total_usdt: Number(totals.net_total),
  });
};

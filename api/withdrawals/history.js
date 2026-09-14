const { sql } = require('../_lib/db');
const { requireUser } = require('../_lib/auth');

// GET /api/withdrawals/history — прошлые выводы со снапшотом расчёта на
// момент каждого из них.
module.exports = async (req, res) => {
  if (req.method !== 'GET') return res.status(405).json({ error: 'method_not_allowed' });

  const user = await requireUser(req, res);
  if (!user) return;

  const { rows } = await sql`
    SELECT id, signals_count, rate_usdt_per_signal, gross_usdt, commission_pct,
           net_usdt, usdt_rub_rate, net_rub, requested_at
    FROM withdrawal_ledger
    WHERE user_id = ${user.id}
    ORDER BY requested_at DESC
  `;

  return res.status(200).json({ items: rows });
};

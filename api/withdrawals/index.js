const { db } = require('../_lib/db');
const { requireUser } = require('../_lib/auth');
const { computeCurrentPeriod } = require('../_lib/earnings');

// POST /api/withdrawals — фиксирует факт вывода (учётная запись, не
// платёж): пересчитывает текущий период на сервере (не доверяя клиенту),
// сохраняет снапшот расчёта и этим же действием закрывает период — уже
// учтённые сигналы больше не попадут в следующий расчёт.
//
// Расчёт и запись идут в одной транзакции с advisory-локом на пользователя,
// чтобы два параллельных запроса на вывод не посчитали одни и те же
// отмеченные сигналы дважды.
module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });

  const user = await requireUser(req, res);
  if (!user) return;

  const client = await db.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [user.id]);

    const period = await computeCurrentPeriod(user.id, (text, params) => client.query(text, params));
    if (!period || period.signalsCount === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'nothing_to_withdraw' });
    }

    const now = new Date().toISOString();
    const insertRes = await client.query(
      `INSERT INTO withdrawal_ledger (
         user_id, period_start, period_end, signals_count, rate_usdt_per_signal,
         gross_usdt, commission_pct, net_usdt, usdt_rub_rate, net_rub, requested_at
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       RETURNING id, signals_count, gross_usdt, commission_pct, net_usdt, usdt_rub_rate, net_rub, requested_at`,
      [
        user.id,
        period.periodStart,
        now,
        period.signalsCount,
        period.rate,
        period.grossUsdt,
        period.commissionPct,
        period.netUsdt,
        period.usdtRubRate,
        period.netRub,
        now,
      ]
    );

    await client.query('COMMIT');
    return res.status(200).json({ withdrawal: insertRes.rows[0] });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('withdrawal error', err);
    return res.status(500).json({ error: 'server_error' });
  } finally {
    client.release();
  }
};

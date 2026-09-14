// Единая точка подключения к Postgres — если провайдера БД когда-нибудь
// придётся сменить (Vercel Postgres → Neon/Supabase напрямую), менять
// нужно только этот файл. `sql` — тегированные шаблоны (авто-параметризация),
// `db` — пул соединений для случаев, когда нужна явная транзакция
// (см. api/withdrawals/index.js).
const { sql, db } = require('@vercel/postgres');

module.exports = { sql, db };

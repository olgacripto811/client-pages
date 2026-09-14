#!/usr/bin/env node
// Разовый bootstrap-скрипт: создаёт первого администратора (Ольгу) напрямую
// в БД — иначе некому одобрять заявки участников через админку.
//
// Запуск (локально, с доступом к БД — например, после `vercel env pull`):
//   POSTGRES_URL=... node scripts/create-admin.js "Ольга" "Фамилия" olga@example.com
//
// Выводит постоянную персональную ссылку для входа в kabinet-admin.html —
// сохраните её, она не логируется и не показывается повторно.

const { sql } = require('@vercel/postgres');
const { randomToken, sha256 } = require('../api/_lib/crypto');

async function main() {
  const [firstName, lastName, email] = process.argv.slice(2);
  if (!firstName || !lastName || !email) {
    console.error('Использование: node scripts/create-admin.js "Имя" "Фамилия" email@example.com');
    process.exit(1);
  }

  const token = randomToken(32);
  const tokenHash = sha256(token);

  const { rows } = await sql`
    INSERT INTO users (first_name, last_name, email, status, role, access_token_hash, approved_at)
    VALUES (${firstName}, ${lastName}, ${email.toLowerCase()}, 'active', 'admin', ${tokenHash}, now())
    ON CONFLICT (email) DO UPDATE
      SET role = 'admin', status = 'active', access_token_hash = ${tokenHash},
          access_token_version = users.access_token_version + 1, approved_at = now()
    RETURNING id, first_name, last_name, email
  `;

  const base = process.env.SITE_ORIGIN || 'https://ЗАМЕНИТЕ-НА-ВАШ-ДОМЕН';
  console.log('Админ создан/обновлён:', rows[0]);
  console.log('Персональная ссылка входа (передайте себе лично, не публикуйте):');
  console.log(`${base}/api/auth/enter?token=${token}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => process.exit(0));

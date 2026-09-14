-- Личный кабинет команды: базовая схема.
-- Новая, отдельная БД (Vercel Postgres / Neon / Supabase) — никак не связана
-- с Airtable-базой старой рассылки (ветка n8n-messenger-broadcast).
--
-- Применить один раз на свежей Postgres БД, например:
--   psql "$POSTGRES_URL" -f db/migrations/001_init.sql

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Уровни/тарифы участников — от уровня зависит ставка USDT за отмеченный сигнал.
CREATE TABLE membership_levels (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name                  text NOT NULL,
  rate_usdt_per_signal  numeric(12,4) NOT NULL DEFAULT 0,
  created_at            timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE users (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name                  text NOT NULL,
  email                 text NOT NULL UNIQUE,
  status                text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','active','revoked')),
  role                  text NOT NULL DEFAULT 'member' CHECK (role IN ('member','admin')),
  level_id              uuid REFERENCES membership_levels(id),
  -- Хэш (sha256) постоянной персональной ссылки-входа. Сам токен нигде
  -- на сервере в открытом виде не хранится и не логируется.
  access_token_hash     text,
  access_token_version  int NOT NULL DEFAULT 1,
  created_at            timestamptz NOT NULL DEFAULT now(),
  approved_at           timestamptz
);
CREATE UNIQUE INDEX idx_users_access_token_hash ON users(access_token_hash) WHERE access_token_hash IS NOT NULL;

-- Обычные серверные сессии (HttpOnly cookie), создаются при переходе по
-- персональной ссылке. Отдельно от самой ссылки — см. README раздел про auth.
CREATE TABLE sessions (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_token_hash  text NOT NULL UNIQUE,
  created_at          timestamptz NOT NULL DEFAULT now(),
  expires_at          timestamptz NOT NULL,
  last_seen_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_sessions_user ON sessions(user_id);

-- Тип/канал сигнала со своим (пока не заданным) расписанием.
CREATE TABLE signal_slots (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  -- Гибкое расписание (дни недели/времена/таймзона) — расписание пришлют
  -- позже, схема готова принять его без изменений.
  schedule    jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Конкретный числовой код на конкретную дату для слота — вводит Ольга.
CREATE TABLE daily_signals (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slot_id       uuid NOT NULL REFERENCES signal_slots(id) ON DELETE CASCADE,
  date          date NOT NULL,
  code          text NOT NULL,
  published_at  timestamptz,
  created_by    uuid REFERENCES users(id),
  UNIQUE (slot_id, date)
);
CREATE INDEX idx_daily_signals_date ON daily_signals(date);

-- Кому какие слоты видны — гибкое per-user назначение (не простые тиры).
CREATE TABLE user_signal_access (
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  slot_id     uuid NOT NULL REFERENCES signal_slots(id) ON DELETE CASCADE,
  granted_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, slot_id)
);

-- Отметка «увидел/ознакомился» — основа и чек-листа, и расчёта заработка.
CREATE TABLE user_signal_ack (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  daily_signal_id  uuid NOT NULL REFERENCES daily_signals(id) ON DELETE CASCADE,
  acked_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, daily_signal_id)
);
CREATE INDEX idx_ack_user ON user_signal_ack(user_id, acked_at);

-- Единственная строка настроек: курс USDT→RUB (пока вводит вручную Ольга,
-- позже можно подключить авто-обновление по API без изменения схемы) и
-- комиссия на вывод.
CREATE TABLE settings (
  id                          boolean PRIMARY KEY DEFAULT true CHECK (id),
  usdt_rub_rate               numeric(12,4) NOT NULL DEFAULT 0,
  usdt_rub_rate_updated_at    timestamptz,
  withdrawal_commission_pct   numeric(5,2) NOT NULL DEFAULT 30
);
INSERT INTO settings (id) VALUES (true);

-- Факт вывода (учётная запись, не платёж) со снапшотом расчёта на момент
-- вывода — по нему же определяется граница следующего периода начисления.
CREATE TABLE withdrawal_ledger (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  period_start          timestamptz NOT NULL,
  period_end            timestamptz NOT NULL,
  signals_count         int NOT NULL,
  rate_usdt_per_signal  numeric(12,4) NOT NULL,
  gross_usdt            numeric(12,4) NOT NULL,
  commission_pct        numeric(5,2) NOT NULL,
  net_usdt              numeric(12,4) NOT NULL,
  usdt_rub_rate         numeric(12,4) NOT NULL,
  net_rub               numeric(12,2) NOT NULL,
  requested_at          timestamptz NOT NULL DEFAULT now(),
  note                  text
);
CREATE INDEX idx_withdrawals_user_period ON withdrawal_ledger(user_id, period_end DESC);

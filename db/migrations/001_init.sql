-- Личный кабинет команды: базовая схема.
-- Новая, отдельная БД (Vercel Postgres / Neon / Supabase) — никак не связана
-- с Airtable-базой старой рассылки (ветка n8n-messenger-broadcast).
--
-- Применить один раз на свежей Postgres БД, например:
--   psql "$POSTGRES_URL" -f db/migrations/001_init.sql

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Уровни/тарифы участников (c3/c4/c5/c6...) — от уровня зависит ставка
-- USDT за отмеченный сигнал и набор доступных слотов сигналов
-- (см. level_signal_access ниже).
CREATE TABLE membership_levels (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name                  text NOT NULL,
  rate_usdt_per_signal  numeric(12,4) NOT NULL DEFAULT 0,
  created_at            timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE users (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name            text NOT NULL,
  last_name             text NOT NULL,
  email                 text NOT NULL UNIQUE,
  -- UID участника на бирже — указывается при заявке, нужен, чтобы Ольга
  -- могла сверить участника с реальными данными на бирже.
  exchange_uid          text,
  status                text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','active','revoked')),
  role                  text NOT NULL DEFAULT 'member' CHECK (role IN ('member','admin')),
  level_id              uuid REFERENCES membership_levels(id),
  -- Лидерский статус — простой флаг (указывается при заявке, Ольга может
  -- включить/выключить в админке). Даёт доступ к сигналам со слотами
  -- requires_leader=true (см. signal_slots), независимо от уровня.
  is_leader             boolean NOT NULL DEFAULT false,
  -- UID лидера, который пригласил участника — просто текст для учёта
  -- Ольгой, без связи с реальной записью (пригласивший может быть кем
  -- угодно, не обязательно зарегистрирован в этой системе).
  referred_by_uid       text,
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

-- Тип/канал сигнала (время дня) со своим (пока не заданным формально)
-- расписанием. requires_leader — слот виден только участникам с
-- users.is_leader=true, независимо от их уровня (например, слот 20:30).
CREATE TABLE signal_slots (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name             text NOT NULL,
  -- Гибкое расписание (дни недели/времена/таймзона) — для будущей
  -- автоматизации; сейчас используется только как справочные данные.
  schedule         jsonb NOT NULL DEFAULT '{}'::jsonb,
  requires_leader  boolean NOT NULL DEFAULT false,
  is_active        boolean NOT NULL DEFAULT true,
  created_at       timestamptz NOT NULL DEFAULT now()
);

-- Какие слоты входят в какой уровень — Ольга настраивает один раз на
-- уровень (не на каждого участника отдельно). Итоговый доступ участника =
-- слоты его уровня ∪ слоты с requires_leader=true (если он лидер).
CREATE TABLE level_signal_access (
  level_id  uuid NOT NULL REFERENCES membership_levels(id) ON DELETE CASCADE,
  slot_id   uuid NOT NULL REFERENCES signal_slots(id) ON DELETE CASCADE,
  PRIMARY KEY (level_id, slot_id)
);

-- Конкретный числовой код на конкретную дату для слота — вводит Ольга.
-- valid_minutes/expires_at — код действует ограниченное время (обычно
-- ~30 минут), после чего в кабинете помечается как неактивный.
CREATE TABLE daily_signals (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slot_id        uuid NOT NULL REFERENCES signal_slots(id) ON DELETE CASCADE,
  date           date NOT NULL,
  code           text NOT NULL,
  valid_minutes  int NOT NULL DEFAULT 30,
  published_at   timestamptz,
  expires_at     timestamptz,
  created_by     uuid REFERENCES users(id),
  UNIQUE (slot_id, date)
);
CREATE INDEX idx_daily_signals_date ON daily_signals(date);

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

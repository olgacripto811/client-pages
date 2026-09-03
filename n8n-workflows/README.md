# Командная рассылка — воркфлоу для n8n

5 готовых к импорту JSON-воркфлоу для рассылки одного сообщения команде в
Telegram + Email + закрытую ленту на сайте, плюс форма самостоятельного
подключения новых участников.

**Важно:** эти файлы собраны вручную, без доступа к реальному n8n. Перед
использованием их нужно импортировать, назначить свои credentials, заменить
все плейсхолдеры `ЗАМЕНИТЬ_...` и проверить каждый шаг по чек-листу в конце
этого файла — с первого раза без правок они не заработают, это нормально.

## Что делает каждый файл

| Файл | Триггер | Что делает |
|---|---|---|
| `team-broadcast-fanout.json` | Execute Workflow (вызывается другими) | Берёт активных участников из Airtable, шлёт всем Telegram (с кнопкой «Скопировать текст») + Email, пишет сообщение в ленту |
| `team-broadcast-telegram-bot.json` | Telegram Trigger | Единственный слушатель бота: `/start <токен>` — подключает участника; сообщение от админа — запускает рассылку |
| `team-broadcast-webhook-compose.json` | Webhook `POST /broadcast/send` | Принимает `{token, message}` с формы на сайте, запускает рассылку |
| `team-signup-webhook.json` | Webhook `POST /team/signup` | Принимает `{name, email}` с формы подключения, создаёт заявку в Airtable, возвращает ссылку на бота |
| `team-board-webhook.json` | Webhook `GET /team/board` | Отдаёт последние сообщения для ленты на сайте по токену |

## Шаг 1 — Telegram-бот

1. В Telegram напишите **@BotFather** → `/newbot`, задайте имя и username
   (заканчивается на `_bot`). Получите **токен бота**.
2. В n8n: Credentials → New → **Telegram API** → вставьте токен.
3. Запомните **username бота** (без `@`) — он понадобится для ссылки в форме
   подключения.
4. У бота может быть только **один активный webhook** — поэтому весь Telegram
   заведён в одном воркфлоу (`team-broadcast-telegram-bot.json`), не создавайте
   второй Telegram Trigger на тот же токен.
5. Отдельно от credential добавьте тот же токен как **переменную окружения**
   n8n: `TELEGRAM_BOT_TOKEN`. Она нужна ноде «Telegram: отправить» в
   `team-broadcast-fanout.json` — та обращается к Bot API напрямую (через
   HTTP Request), чтобы добавить к сообщению кнопку «Скопировать текст»
   (подробнее — в разделе «Копирование сообщения» ниже). Задать переменную
   можно в `docker-compose.yml` (`environment: TELEGRAM_BOT_TOKEN=...`) —
   так токен не попадёт в JSON-файл воркфлоу и не окажется в git.

## Шаг 2 — Airtable

1. Создайте базу, например «Team Broadcast», с двумя таблицами:

   **`Team`**
   | Поле | Тип |
   |---|---|
   | Name | Single line text |
   | Email | Email |
   | TelegramChatID | Single line text |
   | TelegramUsername | Single line text |
   | Status | Single select: `pending`, `active` |
   | SignupToken | Single line text |
   | CreatedAt | Date/time |
   | WhatsAppNumber | Single line text (пока не используется — задел на будущее) |
   | MaxID | Single line text (пока не используется — задел на будущее) |

   **`Messages`**
   | Поле | Тип |
   |---|---|
   | Text | Long text |
   | SentBy | Single line text |
   | SentAt | Date/time |

2. На https://airtable.com/create/tokens создайте Personal Access Token со
   scopes `data.records:read`, `data.records:write` и доступом к этой базе.
3. В n8n: Credentials → New → **Airtable Token API** → вставьте токен.
4. Скопируйте **Base ID** (из URL базы, начинается на `app...`) — им нужно
   заменить `ЗАМЕНИТЬ_AIRTABLE_BASE_ID` во всех воркфлоу.

## Шаг 3 — Email

Во всех примерах используется нода **Gmail** (как и в остальных ваших
воркфлоу — OAuth2, без паролей). В n8n: Credentials → New → **Gmail OAuth2
API** → авторизуйтесь тем аккаунтом, с которого должна уходить рассылка.
Если нужен не Gmail, а обычный SMTP — замените ноду «Gmail: отправить» в
`team-broadcast-fanout.json` на ноду **Send Email (SMTP)**, поля `sendTo`/
`subject`/`message` совпадают по смыслу.

## Шаг 4 — Импорт и настройка воркфлоу

Порядок важен — сначала сабворкфлоу, потом остальные (им нужен его ID).

1. **Импортируйте `team-broadcast-fanout.json`** (Workflows → Import from
   File). Откройте обе Airtable-ноды и ноду «Gmail: отправить» — назначьте
   свои credentials, замените `ЗАМЕНИТЬ_AIRTABLE_BASE_ID` на свой Base ID.
   Нода «Telegram: отправить» credential не использует — она берёт токен из
   переменной окружения `TELEGRAM_BOT_TOKEN` (см. шаг 1.5 выше), просто
   проверьте, что переменная задана. Сохраните и **скопируйте ID этого
   воркфлоу** из адресной строки браузера (после `/workflow/`).
2. **Импортируйте `team-broadcast-telegram-bot.json`**:
   - Назначьте Telegram-credential во всех Telegram-нодах.
   - В ноде «Airtable: найти по токену» и «Airtable: активировать участника»
     — свой Base ID и credential.
   - В ноде «Проверить админа» (Code) замените `ЗАМЕНИТЬ_ID_1,ЗАМЕНИТЬ_ID_2`
     на реальные числовые Telegram id тех, кому можно писать рассылку из
     бота (узнать свой id — написать **@userinfobot**).
   - В ноде «Разослать команде (fanout)» выберите воркфлоу из шага 1
     (замените плейсхолдер `ЗАМЕНИТЬ_ID_ВОРКФЛОУ_team-broadcast-fanout`,
     выбрав его из списка в поле workflowId).
   - Активируйте воркфлоу (toggle Active) — это создаст Telegram-webhook.
3. **Импортируйте `team-broadcast-webhook-compose.json`**:
   - В ноде «Проверить токен» задайте свой `ADMIN_TOKEN` — длинную случайную
     строку, её же вписать в `komanda-rassylka-forma.html`.
   - В ноде «Разослать команде (fanout)» выберите воркфлоу из шага 1.
   - Активируйте. Скопируйте итоговый Production Webhook URL
     (заканчивается на `/broadcast/send`).
4. **Импортируйте `team-signup-webhook.json`**:
   - Airtable-нода — свой Base ID и credential.
   - Нода «Собрать ссылку на бота» — замените `ЗАМЕНИТЬ_BOT_USERNAME` на
     username бота из шага 1.
   - Активируйте, скопируйте webhook URL (`/team/signup`).
5. **Импортируйте `team-board-webhook.json`**:
   - Airtable-нода — свой Base ID и credential.
   - Нода «Проверить токен ленты» — задайте `BOARD_TOKEN`, длинную случайную
     строку (можно ту же, что и `ADMIN_TOKEN`, можно другую, если хотите
     дать команде доступ к чтению ленты, а рассылку оставить только себе).
   - Активируйте, скопируйте webhook URL (`/team/board`).

## Шаг 5 — прописать URL и токены в HTML-страницах сайта

В корне репозитория три страницы: `komanda-rassylka-forma.html`,
`komanda-lenta.html`, `komanda-podklyuchit-rassylku.html`. В каждой в начале
`<script>` — константы вида `const WEBHOOK_URL = "ЗАМЕНИТЬ-НА-РЕАЛЬНЫЙ-N8N-ВЕБХУК"`.
Замените на реальные webhook-адреса из шага 4 (тот же паттерн, что и в
`zayavka-na-avtomatizaciyu-...html`). Токены (`ADMIN_TOKEN`, `BOARD_TOKEN`)
никуда в код страниц не зашиваются — их вводит в поле сама Ольга/команда при
первом заходе, они сохраняются в `localStorage` браузера.

## Чек-лист проверки

```bash
# 1. Форма подключения — должна вернуть deep_link на бота
curl -s -X POST https://ваш-n8n/webhook/team/signup \
  -H 'Content-Type: application/json' \
  -d '{"name":"Тест Тестов","email":"test@example.com"}'

# 2. Откройте вернувшийся deep_link в Telegram, нажмите Start —
#    в Airtable у записи Team должен появиться TelegramChatID и Status=active.

# 3. Рассылка с сайта — должна прийти в Telegram и на email тестового участника
curl -s -X POST https://ваш-n8n/webhook/broadcast/send \
  -H 'Content-Type: application/json' \
  -d '{"token":"ВАШ_ADMIN_TOKEN","message":"Проверка рассылки","sender":"Ольга"}'

# 4. Рассылка из Telegram — напишите боту любым админским аккаунтом любой текст,
#    должно прийти "✅ Разослано команде..." и уйти сообщение остальным.

# 5. Лента на сайте — должна вернуть отправленные выше сообщения
curl -s https://ваш-n8n/webhook/team/board -H 'X-Board-Token: ВАШ_BOARD_TOKEN'
```

## Копирование сообщения адресатом

- **Сайт (`komanda-lenta.html`)** — под каждым сообщением в ленте есть кнопка
  «📋 Копировать», копирует полный текст сообщения в буфер обмена браузера.
  Работает всегда, ограничений по длине текста нет.
- **Telegram** — под сообщением от бота есть кнопка «📋 Скопировать текст»
  (нативная кнопка Telegram Bot API, `copy_text`, появилась в Bot API 7.10).
  Копирует текст прямо в Telegram, без переходов и без участия бота при
  нажатии. **Ограничение Bot API: копируемый текст — не больше 256
  символов.** Если сообщение длиннее, кнопку не добавляем (чтобы не копировать
  обрезанный текст) — получатель всё равно может скопировать сообщение
  обычным способом: зажать сообщение → «Копировать».
- **Email** — почтовые клиенты вырезают JavaScript из писем, поэтому кликабельную
  кнопку «копировать» туда добавить нельзя технически. Текст письма как обычно
  выделяется мышкой и копируется вручную — дополнительно ничего не настраивается.
- **WhatsApp / MAX** — когда будете подключать (см. ниже), у обоих есть
  похожие механики: в WhatsApp Cloud API есть кнопки быстрого ответа/шаблонов,
  но выделенной кнопки «копировать в буфер» нет — там расчёт на обычное
  выделение текста в чате, как в email. У MAX Bot API на момент написания
  этого README отдельной copy-кнопки в документации нет — уточните при
  подключении.

## Что дальше (WhatsApp и MAX)

Осознанно не включены в v1 (см. решение в задаче): WhatsApp — нет
официального API под произвольные личные рассылки без риска бана номера;
MAX — с августа 2025 ботов там могут публиковать только верифицированные
юрлица. Поля `WhatsAppNumber` и `MaxID` уже зарезервированы в таблице `Team`,
чтобы потом не переделывать схему. Когда будете готовы подключать:

- **WhatsApp** — поднимите self-hosted шлюз (например, Evolution API) на
  VPS рядом с n8n, добавьте в `team-broadcast-fanout.json` третью ветку
  после «Get active team»: IF есть `WhatsAppNumber` → HTTP Request нода к
  API вашего шлюза.
- **MAX** — когда появится бот-токен (нужно верифицированное юрлицо,
  business.max.ru), добавьте аналогичную ветку: IF есть `MaxID` → HTTP
  Request к `https://platform-api.max.ru` (или community-нода
  `n8n-nodes-max`, если она у вас установлена).

# NessChat — бэкенд

Node.js/Express + PostgreSQL сервер: регистрация/вход, поиск пользователей,
переписка в реальном времени (Socket.IO) и push-уведомления (Web Push).

## 1. Установка локально

```bash
cd nesschat-backend
npm install
cp .env.example .env
```

Заполните `.env`:
- `DATABASE_URL` — получите на [neon.tech](https://neon.tech) (бесплатный PostgreSQL, регистрация без карты)
- `JWT_SECRET` — сгенерируйте: `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"`
- `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` — сгенерируйте: `npx web-push generate-vapid-keys`

Примените схему БД:
```bash
npm run migrate
```

Запустите сервер:
```bash
npm start
```

Проверка: откройте `http://localhost:3000/health` — должно вернуть `{"status":"ok"}`.

## 2. Бесплатный деплой (Render + Neon)

1. **Neon.tech**: создайте проект → скопируйте connection string → это ваш `DATABASE_URL`
2. **GitHub**: залейте эту папку в репозиторий (не забудьте `.gitignore` с `.env` и `node_modules`)
3. **Render.com**: New → Web Service → подключите репозиторий
   - Build Command: `npm install`
   - Start Command: `npm start`
   - Добавьте те же переменные окружения из `.env` в разделе Environment
4. После деплоя выполните миграцию один раз: в Render можно временно поставить Start Command на `npm run migrate && npm start`, задеплоить, затем вернуть обратно на `npm start`

**Важно про free tier Render:** сервис "засыпает" после 15 минут без запросов, первый запрос после этого выполняется 30–50 секунд. Для чата это означает задержку первого сообщения после долгого простоя. Если это критично — на будущее можно посмотреть Railway или платный tier Render (от $7/мес).

## 3. Интеграция с текущим HTML-файлом (nesschat-mood-tracker.html)

Понадобится подключить Socket.IO на клиенте:
```html
<script src="https://cdn.socket.io/4.7.5/socket.io.min.js"></script>
```

### Регистрация / вход
```javascript
const res = await fetch('https://ваш-сервер.onrender.com/api/auth/register', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ username, password })
});
const { token, user } = await res.json();
localStorage.setItem('nesschat_token', token); // только токен, не пароль
```

### Подключение сокета
```javascript
const socket = io('https://ваш-сервер.onrender.com', {
  auth: { token: localStorage.getItem('nesschat_token') }
});

socket.on('new_message', (msg) => {
  // добавить сообщение в UI
});

function sendMessage(chatId, text) {
  socket.emit('send_message', { chatId, text });
}
```

### Поиск пользователей
```javascript
const res = await fetch(`https://ваш-сервер.onrender.com/api/users/search?query=${query}`, {
  headers: { Authorization: `Bearer ${token}` }
});
const { users } = await res.json();
```

### Подписка на push-уведомления (нужен Service Worker)
Понадобится отдельный файл `sw.js` в корне сайта:
```javascript
// sw.js
self.addEventListener('push', (event) => {
  const data = event.data.json();
  self.registration.showNotification(data.title, { body: data.body });
});
```

И на клиенте:
```javascript
const reg = await navigator.serviceWorker.register('/sw.js');
const { publicKey } = await fetch('https://ваш-сервер.onrender.com/api/push/public-key').then(r => r.json());

const subscription = await reg.pushManager.subscribe({
  userVisibleOnly: true,
  applicationServerKey: publicKey
});

await fetch('https://ваш-сервер.onrender.com/api/users/push-subscribe', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
  body: JSON.stringify(subscription)
});
```

## Структура проекта

```
nesschat-backend/
├── server.js              # точка входа
├── db/
│   ├── schema.sql          # структура таблиц
│   ├── migrate.js          # применяет schema.sql к базе
│   └── pool.js             # подключение к PostgreSQL
├── middleware/
│   └── auth.js             # проверка JWT
├── routes/
│   ├── auth.js              # регистрация / вход
│   ├── users.js             # поиск, push-подписка
│   └── chats.js              # чаты, история сообщений
├── socket/
│   └── index.js             # обработка сообщений в реальном времени
└── utils/
    └── webpush.js            # отправка push-уведомлений
```

## Следующие шаги, если понадобится

- Групповые чаты (таблицы уже это поддерживают через `type = 'group'`, нужны только новые роуты)
- Статусы "прочитано" (поле `read_at` в `messages` уже есть, нужно обновлять его по API)
- Загрузка изображений/файлов в чат (потребуется файловое хранилище, например Cloudinary — тоже есть бесплатный tier)

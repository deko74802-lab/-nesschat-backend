const webpush = require('web-push');
const pool = require('../db/pool');

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT,
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

// Отправляет push-уведомление всем сохранённым подпискам пользователя
// (у одного пользователя может быть несколько устройств/браузеров)
async function sendPushToUser(userId, payload) {
  const subs = await pool.query(
    'SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = $1',
    [userId]
  );

  const notifications = subs.rows.map((sub) => {
    const subscription = {
      endpoint: sub.endpoint,
      keys: { p256dh: sub.p256dh, auth: sub.auth }
    };

    return webpush.sendNotification(subscription, JSON.stringify(payload)).catch(async (err) => {
      // 410/404 значит подписка больше не действительна (например, пользователь удалил приложение) — чистим её
      if (err.statusCode === 410 || err.statusCode === 404) {
        await pool.query('DELETE FROM push_subscriptions WHERE endpoint = $1', [sub.endpoint]);
      } else {
        console.error('Ошибка отправки push:', err.message);
      }
    });
  });

  await Promise.all(notifications);
}

module.exports = { sendPushToUser };

// Запускает schema.sql против базы данных из DATABASE_URL
// Использование: npm run migrate
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function migrate() {
  const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  console.log('Применяю schema.sql...');
  await pool.query(sql);
  console.log('Готово. Таблицы созданы/обновлены.');
  await pool.end();
}

migrate().catch((err) => {
  console.error('Ошибка миграции:', err.message);
  process.exit(1);
});

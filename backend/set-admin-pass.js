const bcrypt = require('bcryptjs');
const { Pool } = require('pg');

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'gims_db',
  user: 'postgres',
  password: 'postgres123'
});

async function run() {
  const hash = bcrypt.hashSync('admin123', 10);
  const result = await pool.query(
    "UPDATE users SET password_hash = $1 WHERE role = 'admin' AND deleted_at IS NULL RETURNING name, phone",
    [hash]
  );
  console.log('Admin credentials set:');
  result.rows.forEach(u => console.log('Phone:', u.phone, '| Name:', u.name));
  console.log('\nPassword: admin123');
  await pool.end();
}

run().catch(console.error);

const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Create the technicians table if it doesn't exist
async function ensureTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS technicians (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      phone TEXT,
      email TEXT,
      trade TEXT,
      type TEXT NOT NULL DEFAULT 'contractor',
      active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  const client = await pool.connect();
  try {
    await ensureTable(client);

    // GET - list all active technicians
    if (event.httpMethod === 'GET') {
      const result = await client.query(
        `SELECT * FROM technicians WHERE active = true ORDER BY type ASC, name ASC`
      );
      return { statusCode: 200, headers, body: JSON.stringify(result.rows) };
    }

    // POST - add a new technician
    if (event.httpMethod === 'POST') {
      const { name, phone, email, trade, type } = JSON.parse(event.body || '{}');
      if (!name || !type) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Name and type are required.' }) };
      }
      const result = await client.query(
        `INSERT INTO technicians (name, phone, email, trade, type) VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [name.trim(), phone || null, email || null, trade || null, type]
      );
      return { statusCode: 201, headers, body: JSON.stringify(result.rows[0]) };
    }

    // DELETE - soft-delete (deactivate) a technician
    if (event.httpMethod === 'DELETE') {
      const id = event.path.split('/').pop();
      await client.query(`UPDATE technicians SET active = false WHERE id = $1`, [id]);
      return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
    }

    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };

  } catch (err) {
    console.error('Technicians error:', err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  } finally {
    client.release();
  }
};

const { Client } = require("pg");

exports.handler = async function(event) {
  var headers = {
    "Access-Control-Allow-Origin": "*",
    "Content-Type": "application/json"
  };

  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: headers, body: "" };

  var client = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

  try {
    await client.connect();

    // Create companies table if it doesn't exist
    await client.query(`
      CREATE TABLE IF NOT EXISTS companies (
        id SERIAL PRIMARY KEY,
        name TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        email TEXT,
        phone TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // GET - list all companies (for dispatcher)
    if (event.httpMethod === "GET") {
      var result = await client.query("SELECT id, name, email, phone, created_at FROM companies ORDER BY name ASC");
      return { statusCode: 200, headers: headers, body: JSON.stringify(result.rows) };
    }

    // POST - create company
    if (event.httpMethod === "POST") {
      var body = JSON.parse(event.body);
      if (!body.name || !body.password) {
        return { statusCode: 400, headers: headers, body: JSON.stringify({ error: "Name and password required" }) };
      }
      var res = await client.query(
        "INSERT INTO companies (name, password, email, phone) VALUES ($1, $2, $3, $4) RETURNING id, name, email, phone, created_at",
        [body.name.trim(), body.password, body.email || "", body.phone || ""]
      );
      return { statusCode: 201, headers: headers, body: JSON.stringify(res.rows[0]) };
    }

    // PATCH - update company
    if (event.httpMethod === "PATCH") {
      var body = JSON.parse(event.body);
      var id = event.path.split("/").pop();
      var fields = [];
      var values = [];
      var idx = 1;
      if (body.password) { fields.push("password = $" + idx++); values.push(body.password); }
      if (body.email !== undefined) { fields.push("email = $" + idx++); values.push(body.email); }
      if (body.phone !== undefined) { fields.push("phone = $" + idx++); values.push(body.phone); }
      if (fields.length === 0) return { statusCode: 400, headers: headers, body: JSON.stringify({ error: "Nothing to update" }) };
      values.push(id);
      var res = await client.query(
        "UPDATE companies SET " + fields.join(", ") + " WHERE id = $" + idx + " RETURNING id, name, email, phone",
        values
      );
      return { statusCode: 200, headers: headers, body: JSON.stringify(res.rows[0]) };
    }

    // DELETE - remove company
    if (event.httpMethod === "DELETE") {
      var id = event.path.split("/").pop();
      await client.query("DELETE FROM companies WHERE id = $1", [id]);
      return { statusCode: 200, headers: headers, body: JSON.stringify({ ok: true }) };
    }

    return { statusCode: 405, headers: headers, body: JSON.stringify({ error: "Method not allowed" }) };

  } catch(e) {
    console.log("ERROR:", e.message);
    return { statusCode: 500, headers: headers, body: JSON.stringify({ error: e.message }) };
  } finally {
    await client.end();
  }
};

const { Client } = require("pg");

exports.handler = async function(event) {
  var headers = {
    "Access-Control-Allow-Origin": "*",
    "Content-Type": "application/json"
  };

  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: headers, body: "" };
  if (event.httpMethod !== "POST") return { statusCode: 405, headers: headers, body: JSON.stringify({ error: "Method not allowed" }) };

  var client = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

  try {
    var body = JSON.parse(event.body);
    var name = (body.name || "").trim();
    var password = body.password || "";

    if (!name || !password) {
      return { statusCode: 400, headers: headers, body: JSON.stringify({ error: "Company name and password required" }) };
    }

    await client.connect();

    var result = await client.query(
      "SELECT id, name, email, phone FROM companies WHERE LOWER(name) = LOWER($1) AND password = $2",
      [name, password]
    );

    if (result.rows.length === 0) {
      return { statusCode: 401, headers: headers, body: JSON.stringify({ error: "Invalid company name or password" }) };
    }

    return { statusCode: 200, headers: headers, body: JSON.stringify({ company: result.rows[0] }) };

  } catch(e) {
    console.log("ERROR:", e.message);
    return { statusCode: 500, headers: headers, body: JSON.stringify({ error: e.message }) };
  } finally {
    await client.end();
  }
};

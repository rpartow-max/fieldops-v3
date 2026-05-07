const { Client } = require("pg");

exports.handler = async function(event) {
  var headers = {
    "Access-Control-Allow-Origin": "*",
    "Content-Type": "application/json"
  };

  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: headers, body: "" };
  if (event.httpMethod !== "DELETE") return { statusCode: 405, headers: headers, body: JSON.stringify({ error: "Method not allowed" }) };

  var client = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

  try {
    var body = JSON.parse(event.body);
    var recordId = body._recordId;

    if (!recordId) return { statusCode: 400, headers: headers, body: JSON.stringify({ error: "Missing _recordId" }) };

    await client.connect();

    var result = await client.query("DELETE FROM work_orders WHERE id = $1", [recordId]);

    if (result.rowCount === 0) {
      return { statusCode: 404, headers: headers, body: JSON.stringify({ error: "Work order not found" }) };
    }

    return { statusCode: 200, headers: headers, body: JSON.stringify({ success: true }) };

  } catch (err) {
    console.error("delete-order error:", err);
    return { statusCode: 500, headers: headers, body: JSON.stringify({ error: "Server error" }) };
  } finally {
    await client.end().catch(() => {});
  }
};

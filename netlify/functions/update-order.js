const { Client } = require("pg");

const DB_URL = process.env.DATABASE_URL;

exports.handler = async function(event) {
  var headers = {
    "Access-Control-Allow-Origin": "*",
    "Content-Type": "application/json"
  };

  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: headers, body: "" };
  if (event.httpMethod !== "PATCH") return { statusCode: 405, headers: headers, body: JSON.stringify({ error: "Method not allowed" }) };

  var client = new Client({ connectionString: DB_URL, ssl: { rejectUnauthorized: false } });
  try {
    var body = JSON.parse(event.body);
    var recordId = body._recordId;
    if (!recordId) return { statusCode: 400, headers: headers, body: JSON.stringify({ error: "Missing _recordId" }) };

    await client.connect();

    var current = await client.query("SELECT * FROM work_orders WHERE id = $1", [recordId]);
    if (current.rows.length === 0) return { statusCode: 404, headers: headers, body: JSON.stringify({ error: "Not found" }) };

    var row = current.rows[0];
    var existingUpdates = row.updates || [];
    var now = new Date().toISOString();

    if (body.status && body.status !== row.status) {
      var msgs = {
        "dispatched": "Dispatched to " + (body.assignedTech || row.assigned_tech || "technician"),
        "in_progress": "Job started",
        "completed": "Job marked complete",
        "on_hold": "Put on hold"
      };
      existingUpdates.push({ msg: msgs[body.status] || "Status updated", time: now, type: body.status === "completed" ? "complete" : "update" });
    }

    if (body.progress !== undefined && body.progress !== row.progress) {
      existingUpdates.push({ msg: "Progress updated to " + body.progress + "%", time: now, type: "update" });
    }

    var result = await client.query(
      `UPDATE work_orders SET
        status = COALESCE($1, status),
        assigned_tech = COALESCE($2, assigned_tech),
        progress = COALESCE($3, progress),
        notes = COALESCE($4, notes),
        updates = $5
       WHERE id = $6 RETURNING *`,
      [
        body.status || null,
        body.assignedTech !== undefined ? body.assignedTech : null,
        body.progress !== undefined ? body.progress : null,
        body.notes ? JSON.stringify(body.notes) : null,
        JSON.stringify(existingUpdates),
        recordId
      ]
    );

    var r = result.rows[0];
    var order = {
      id: r.wo_id,
      _recordId: r.id,
      title: r.title,
      description: r.description,
      serviceType: r.service_type,
      priority: r.priority,
      status: r.status,
      company: r.company,
      customerName: r.customer_name,
      customerEmail: r.customer_email,
      customerPhone: r.customer_phone,
      siteAddress: r.site_address,
      preferredDate: r.preferred_date,
      assignedTech: r.assigned_tech,
      progress: r.progress,
      notes: r.notes || [],
      updates: existingUpdates,
      attachments: r.attachments || [],
      createdAt: r.created_at
    };

    return { statusCode: 200, headers: headers, body: JSON.stringify(order) };
  } catch(e) {
    return { statusCode: 500, headers: headers, body: JSON.stringify({ error: e.message }) };
  } finally {
    await client.end();
  }
};

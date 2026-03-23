const { Client } = require("pg");

const DB_URL = process.env.DATABASE_URL;

exports.handler = async function(event) {
  var headers = {
    "Access-Control-Allow-Origin": "*",
    "Content-Type": "application/json"
  };

  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: headers, body: "" };
  if (event.httpMethod !== "POST") return { statusCode: 405, headers: headers, body: JSON.stringify({ error: "Method not allowed" }) };

  var client = new Client({ connectionString: DB_URL, ssl: { rejectUnauthorized: false } });
  try {
    var body = JSON.parse(event.body);
    var woId = "WO-" + Date.now().toString(36).toUpperCase();
    var now = new Date().toISOString();
    var updates = [{ msg: "Work order created", time: now, type: "info" }];
    if (body.assignedTech) {
      updates.push({ msg: "Assigned to " + body.assignedTech, time: now, type: "dispatch" });
    }

    await client.connect();

    // Create table if it doesn't exist
    await client.query(`
      CREATE TABLE IF NOT EXISTS work_orders (
        id SERIAL PRIMARY KEY,
        wo_id TEXT UNIQUE,
        title TEXT,
        description TEXT,
        service_type TEXT,
        priority TEXT,
        status TEXT DEFAULT 'new',
        company TEXT,
        customer_name TEXT,
        customer_email TEXT,
        customer_phone TEXT,
        site_address TEXT,
        preferred_date TEXT,
        assigned_tech TEXT,
        progress INTEGER DEFAULT 0,
        notes JSONB DEFAULT '[]',
        updates JSONB DEFAULT '[]',
        attachments JSONB DEFAULT '[]',
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    var result = await client.query(
      `INSERT INTO work_orders 
        (wo_id, title, description, service_type, priority, status, company, customer_name, customer_email, customer_phone, site_address, preferred_date, assigned_tech, progress, notes, updates, attachments, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
       RETURNING *`,
      [
        woId, body.title, body.description,
        body.serviceType || "Repair", body.priority || "Normal",
        body.assignedTech ? "dispatched" : "new",
        body.company || "", body.customerName || "",
        body.customerEmail || "", body.customerPhone || "",
        body.siteAddress || "", body.preferredDate || "",
        body.assignedTech || "", 0,
        JSON.stringify([]), JSON.stringify(updates), JSON.stringify([]), now
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
      notes: [],
      updates: updates,
      attachments: [],
      createdAt: r.created_at
    };

    return { statusCode: 201, headers: headers, body: JSON.stringify(order) };
  } catch(e) {
    return { statusCode: 500, headers: headers, body: JSON.stringify({ error: e.message }) };
  } finally {
    await client.end();
  }
};

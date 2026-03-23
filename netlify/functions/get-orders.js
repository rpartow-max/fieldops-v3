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

    // Filter by company if provided (for customer portal)
    var company = event.queryStringParameters && event.queryStringParameters.company;
    var result;
    if (company) {
      result = await client.query(
        "SELECT * FROM work_orders WHERE LOWER(company) = LOWER($1) ORDER BY created_at DESC",
        [company]
      );
    } else {
      result = await client.query("SELECT * FROM work_orders ORDER BY created_at DESC");
    }

    var orders = result.rows.map(function(r) {
      return {
        id: r.wo_id,
        _recordId: r.id,
        title: r.title || "",
        description: r.description || "",
        serviceType: r.service_type || "Repair",
        priority: r.priority || "Normal",
        status: r.status || "new",
        company: r.company || "",
        customerName: r.customer_name || "",
        customerEmail: r.customer_email || "",
        customerPhone: r.customer_phone || "",
        siteAddress: r.site_address || "",
        preferredDate: r.preferred_date || "",
        assignedTech: r.assigned_tech || "",
        progress: r.progress || 0,
        notes: r.notes || [],
        updates: r.updates || [],
        attachments: r.attachments || [],
        createdAt: r.created_at
      };
    });
    return { statusCode: 200, headers: headers, body: JSON.stringify(orders) };
  } catch(e) {
    return { statusCode: 500, headers: headers, body: JSON.stringify({ error: e.message, hasDb: !!process.env.DATABASE_URL }) };
  } finally {
    await client.end();
  }
};

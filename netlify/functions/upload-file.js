exports.handler = async function(event) {
  var headers = {
    "Access-Control-Allow-Origin": "*",
    "Content-Type": "application/json"
  };
  return { statusCode: 200, headers: headers, body: JSON.stringify({ ok: true }) };
};

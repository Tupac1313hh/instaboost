// GET /.netlify/functions/check-payment?id=<payment_id>
// Retorna: { id, status, status_detail }

const CORS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function json(statusCode, body) {
  return { statusCode, headers: CORS, body: JSON.stringify(body) };
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS, body: '' };

  const token = process.env.MP_ACCESS_TOKEN;
  if (!token) return json(500, { error: 'MP_ACCESS_TOKEN não configurado no servidor' });

  const id = event.queryStringParameters && event.queryStringParameters.id;
  if (!id || !/^\d+$/.test(String(id))) {
    return json(400, { error: 'ID de pagamento inválido' });
  }

  try {
    const res = await fetch('https://api.mercadopago.com/v1/payments/' + encodeURIComponent(id), {
      headers: { 'Authorization': 'Bearer ' + token },
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      return json(res.status, { error: data.message || 'Erro ao consultar pagamento' });
    }

    return json(200, {
      id: data.id,
      status: data.status,
      status_detail: data.status_detail,
    });
  } catch (err) {
    return json(500, { error: 'Falha ao consultar Mercado Pago: ' + (err.message || String(err)) });
  }
};

// POST /.netlify/functions/send-order
// Body: { planId, ig }
// Retorna: { order } ou { error }

const PLANS = {
  '500':  { followers: 500  },
  '1000': { followers: 1000 },
  '2500': { followers: 2500 },
  '5000': { followers: 5000 },
};

const CORS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function json(statusCode, body) {
  return { statusCode, headers: CORS, body: JSON.stringify(body) };
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS, body: '' };
  if (event.httpMethod !== 'POST')    return json(405, { error: 'Method not allowed' });

  const apiKey = process.env.SMM_API_KEY;
  if (!apiKey) return json(500, { error: 'SMM_API_KEY não configurado no servidor' });

  const serviceId = process.env.SMM_SERVICE_ID || '1178';

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return json(400, { error: 'Body inválido' }); }

  const { planId, ig } = body;

  const plan = PLANS[planId];
  if (!plan) return json(400, { error: 'Plano inválido' });
  if (!ig || !/^[a-zA-Z0-9._]{1,30}$/.test(ig)) return json(400, { error: 'Usuário do Instagram inválido' });

  const igUrl = 'https://www.instagram.com/' + ig + '/';

  const params = new URLSearchParams({
    key: apiKey,
    action: 'add',
    service: serviceId,
    link: igUrl,
    quantity: String(plan.followers),
  });

  try {
    const res = await fetch('https://baratosociais.com/api/v2?' + params.toString());
    const text = await res.text();

    let data;
    try { data = JSON.parse(text); }
    catch { return json(502, { error: 'Resposta inválida do fornecedor' }); }

    if (data.error) {
      return json(502, { error: data.error });
    }

    if (!data.order) {
      return json(502, { error: 'Pedido sem ID retornado' });
    }

    return json(200, { order: data.order });
  } catch (err) {
    return json(500, { error: 'Falha ao chamar fornecedor: ' + (err.message || String(err)) });
  }
};

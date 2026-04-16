// POST /.netlify/functions/create-payment
// Body: { planId, name, email, cpf, ig }
// Retorna: { id, qr_code, qr_code_base64, status, planId, ig }

// Catálogo de planos — fonte única da verdade do preço.
// Deixa aqui no servidor pra ninguém conseguir spoof do preço mandando
// valores diferentes no body do request.
const PLANS = {
  '500':  { followers: 500,  price:  9.90, label: '500 seguidores'   },
  '1000': { followers: 1000, price: 17.90, label: '1.000 seguidores' },
  '2500': { followers: 2500, price: 34.90, label: '2.500 seguidores' },
  '5000': { followers: 5000, price: 59.90, label: '5.000 seguidores' },
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

  const token = process.env.MP_ACCESS_TOKEN;
  if (!token) return json(500, { error: 'MP_ACCESS_TOKEN não configurado no servidor' });

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return json(400, { error: 'Body inválido' }); }

  const { planId, name, email, cpf, ig } = body;

  // Validação
  const plan = PLANS[planId];
  if (!plan) return json(400, { error: 'Plano inválido' });
  if (!name || !email || !cpf || !ig) return json(400, { error: 'Campos obrigatórios faltando' });

  const cleanCpf = String(cpf).replace(/\D/g, '');
  if (cleanCpf.length !== 11) return json(400, { error: 'CPF inválido' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json(400, { error: 'Email inválido' });
  if (!/^[a-zA-Z0-9._]{1,30}$/.test(ig)) return json(400, { error: 'Usuário do Instagram inválido' });

  const parts = String(name).trim().split(/\s+/);
  if (parts.length < 2) return json(400, { error: 'Informe nome e sobrenome' });
  const first_name = parts[0];
  const last_name  = parts.slice(1).join(' ');

  const idempotencyKey = 'ib_' + Date.now() + '_' + Math.random().toString(36).slice(2);

  const mpPayload = {
    transaction_amount: plan.price,
    description: plan.label + ' — InstaBoost',
    payment_method_id: 'pix',
    payer: {
      email: email,
      first_name: first_name,
      last_name: last_name,
      identification: { type: 'CPF', number: cleanCpf },
    },
  };

  try {
    const res = await fetch('https://api.mercadopago.com/v1/payments', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token,
        'X-Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify(mpPayload),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      return json(res.status, {
        error: data.message || data.error || 'Erro ao gerar PIX no Mercado Pago',
        cause: data.cause || null,
      });
    }

    const tx = data && data.point_of_interaction && data.point_of_interaction.transaction_data;
    if (!tx || !tx.qr_code) {
      return json(502, { error: 'Resposta do Mercado Pago sem QR code PIX' });
    }

    return json(200, {
      id: data.id,
      status: data.status,
      qr_code: tx.qr_code,
      qr_code_base64: tx.qr_code_base64,
      planId,
      ig,
    });
  } catch (err) {
    return json(500, { error: 'Falha ao chamar Mercado Pago: ' + (err.message || String(err)) });
  }
};

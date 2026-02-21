// Para producción, descomenta la siguiente línea:
// const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const { randomUUID } = require('crypto');

// Mock de Stripe para desarrollo sin claves
const mockStripe = {
  checkout: {
    sessions: {
      create: async (params) => {
        console.log('Mock Stripe: Creando Checkout Session con params:', params);
        
        // Simular URL de checkout
        const sessionId = 'cs_test_' + randomUUID();
        const checkoutUrl = `https://checkout.stripe.com/pay/${sessionId}`;
        
        return {
          id: sessionId,
          url: checkoutUrl,
          payment_status: 'unpaid',
          metadata: params.metadata,
        };
      },
    },
  },
};

// Usar Stripe real si está disponible, sino mock
const stripe = process.env.STRIPE_SECRET_KEY 
  ? require('stripe')(process.env.STRIPE_SECRET_KEY)
  : mockStripe;

const json = (statusCode, body, extraHeaders = {}) => ({
  statusCode,
  headers: {
    'Content-Type': 'application/json; charset=utf-8',
    ...extraHeaders,
  },
  body: JSON.stringify(body ?? {}),
});

const corsHeaders = (event) => {
  const origin = event.headers?.origin || event.headers?.Origin;
  const allowedRaw = process.env.ALLOWED_ORIGINS;
  const allowedList =
    typeof allowedRaw === 'string' && allowedRaw.trim().length > 0
      ? allowedRaw
      : 'http://localhost:8888,http://127.0.0.1:8888,http://localhost:5173,http://127.0.0.1:5173';
  const allowed = allowedList
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  if (allowed.includes('*') || allowed.includes(origin)) {
    return {
      'Access-Control-Allow-Origin': origin || '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };
  }

  return {};
};

const getEnvNumber = (name, fallback) => {
  const raw = process.env[name];
  const n = raw === undefined || raw === null || raw === '' ? NaN : Number(raw);
  return Number.isFinite(n) ? n : fallback;
};

const PLATFORM_FEE_THRESHOLD_CENTS = getEnvNumber('PLATFORM_FEE_THRESHOLD_CENTS', 1000);
const PLATFORM_FEE_FIXED_CENTS = getEnvNumber('PLATFORM_FEE_FIXED_CENTS', 100);
const PLATFORM_FEE_RATE = getEnvNumber('PLATFORM_FEE_RATE', 0.05);

const CARD_PROCESSING_RATE = getEnvNumber('CARD_PROCESSING_RATE', 0.054);
const CARD_PROCESSING_FIXED_CENTS = getEnvNumber('CARD_PROCESSING_FIXED_CENTS', 10);

const calcularComision = (amountCents) => {
  if (Number(amountCents) < PLATFORM_FEE_THRESHOLD_CENTS) return Math.round(PLATFORM_FEE_FIXED_CENTS);
  return Math.round(Number(amountCents) * PLATFORM_FEE_RATE);
};

// Calcular fee de Stripe estimado en centavos. Ojo: el fee depende del total cobrado,
// así que resolvemos stripeFee = a*(base+stripeFee)+b => stripeFee=(a*base+b)/(1-a)
const calcularStripeFeeCents = (baseCents) => {
  const a = CARD_PROCESSING_RATE;
  const b = CARD_PROCESSING_FIXED_CENTS;
  const raw = (a * Number(baseCents) + b) / (1 - a);
  return Math.round(raw);
};

exports.handler = async (event) => {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: corsHeaders(event),
      body: '',
    };
  }

  if (event.httpMethod !== 'POST') {
    return json(405, { error: 'Method not allowed' }, corsHeaders(event));
  }

  try {
    const { cashAmount, surchargeAmount, connectedAccountId, dteJson, sellerInfo } = JSON.parse(event.body);

    // Validar montos
    if (!cashAmount || cashAmount <= 0) {
      return json(400, { error: 'Monto efectivo inválido' }, corsHeaders(event));
    }
    // `surchargeAmount` se ignora (si viene) para evitar inconsistencias: el backend manda.
    const platformFeeCents = calcularComision(Number(cashAmount));
    const baseBeforeStripeCents = Number(cashAmount) + platformFeeCents;
    const stripeFeeCents = calcularStripeFeeCents(baseBeforeStripeCents);
    const surchargeTotalCents = platformFeeCents + stripeFeeCents;
    const finalAmount = Number(cashAmount) + surchargeTotalCents;

    console.log(
      `Procesando pago tarjeta: total=$${finalAmount / 100} (efectivo=$${Number(cashAmount) / 100} + plataforma=$${platformFeeCents / 100} + stripe=$${stripeFeeCents / 100})`
    );

    // Crear Checkout Session
    const sessionParams = {
      payment_method_types: ['card', 'apple_pay', 'google_pay'],
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: {
            name: sellerInfo?.businessName || 'Pago de Factura',
            description: `Factura ${dteJson?.identificacion?.numeroControl || 'N/A'}`,
          },
          unit_amount: finalAmount,
        },
        quantity: 1,
      }],
      mode: 'payment',
      success_url: `${event.headers.origin}/pago-exito?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${event.headers.origin}/pago-cancelado?session_id={CHECKOUT_SESSION_ID}`,
      metadata: {
        dteNumeroControl: dteJson?.identificacion?.numeroControl || '',
        dteCodigoGeneracion: dteJson?.identificacion?.codigoGeneracion || '',
        clienteNit: dteJson?.receptor?.nit || '',
        clienteNombre: dteJson?.receptor?.nombre || '',
        sellerId: connectedAccountId || '',
        cashAmount: (Number(cashAmount) / 100).toString(),
        surchargeAmount: (surchargeTotalCents / 100).toString(),
        platformFee: (platformFeeCents / 100).toString(),
        stripeFee: (stripeFeeCents / 100).toString(),
        cardAmount: (finalAmount / 100).toString(),
      },
      // Para Stripe Connect
      ...(connectedAccountId && {
        payment_intent_data: {
          application_fee_amount: surchargeTotalCents,
          transfer_data: {
            destination: connectedAccountId,
            amount: Number(cashAmount),
          },
        },
      }),
    };

    const session = await stripe.checkout.sessions.create(sessionParams);

    return json(200, {
      success: true,
      sessionId: session.id,
      checkoutUrl: session.url,
      fees: {
        cashAmount: Number(cashAmount) / 100,
        surchargeAmount: surchargeTotalCents / 100,
        platformFee: platformFeeCents / 100,
        stripeFee: stripeFeeCents / 100,
        cardAmount: finalAmount / 100,
      },
      message: 'Link de pago generado exitosamente',
    }, corsHeaders(event));

  } catch (error) {
    console.error('Error generando Checkout Session:', error);
    return json(500, { 
      error: 'Error generando link de pago',
      details: error.message 
    }, corsHeaders(event));
  }
};

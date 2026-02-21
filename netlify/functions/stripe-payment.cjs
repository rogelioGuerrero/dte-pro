// Para producción, descomenta la siguiente línea:
// const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const { randomUUID } = require('crypto');

// Calcular comisión (único modelo)
const calcularComision = (amount) => {
  // amount está en centavos
  if (amount < 1000) { // < $10
    return 100; // $1 fijo
  } else {
    return Math.round(amount * 0.05); // 5%
  }
};

// Mock de Stripe para desarrollo sin claves
const mockStripe = {
  paymentIntents: {
    create: async (params) => {
      // Simular procesamiento
      console.log('Mock Stripe: Creando Payment Intent con params:', params);
      
      // Simular diferentes respuestas según el monto
      if (params.amount < 1000) { // < $10
        return {
          id: 'pi_test_' + randomUUID(),
          status: 'succeeded',
          client_secret: 'pi_test_secret_' + randomUUID(),
          metadata: params.metadata,
        };
      } else if (params.amount < 5000) { // < $50
        return {
          id: 'pi_test_' + randomUUID(),
          status: 'requires_action',
          client_secret: 'pi_test_secret_' + randomUUID(),
          metadata: params.metadata,
        };
      } else {
        return {
          id: 'pi_test_' + randomUUID(),
          status: 'succeeded',
          client_secret: 'pi_test_secret_' + randomUUID(),
          metadata: params.metadata,
        };
      }
    },
  },
};

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
    const { dteJson, paymentMethodId, connectedAccountId } = JSON.parse(event.body);

    // Validar DTE JSON
    if (!dteJson || !dteJson.identificacion || !dteJson.identificacion.numeroControl) {
      return json(400, { error: 'DTE JSON inválido' }, corsHeaders(event));
    }

    // Calcular total con IVA
    const totalSinIva = dteJson.resumen?.totalGravada || 0;
    const iva = dteJson.resumen?.totalIva || 0;
    const totalConIva = totalSinIva + iva;

    // Convertir a centavos para Stripe
    const amount = Math.round(totalConIva * 100);

    // Crear Payment Intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency: 'usd',
      payment_method: paymentMethodId,
      confirm: true,
      confirmation_method: 'manual',
      metadata: {
        dteNumeroControl: dteJson.identificacion.numeroControl,
        dteCodigoGeneracion: dteJson.identificacion.codigoGeneracion,
        clienteNit: dteJson.receptor?.nit || '',
        clienteNombre: dteJson.receptor?.nombre || '',
      },
      // Para Stripe Connect (futuro)
      ...(connectedAccountId && {
        transfer_data: {
          destination: connectedAccountId,
          amount: Math.round((amount * 0.945) / 100), // 94.5% al cliente
        },
      }),
    });

    // Si el pago requiere autenticación 3D Secure
    if (paymentIntent.status === 'requires_action') {
      return json(200, {
        requiresAction: true,
        clientSecret: paymentIntent.client_secret,
      }, corsHeaders(event));
    }

    // Pago exitoso
    if (paymentIntent.status === 'succeeded') {
      // Calcular comisiones
      const yourFee = calcularComision(amount);
      const stripeFee = Math.round(amount * 0.054) + 10; // 5.4% + $0.10
      const netAmount = amount - stripeFee - yourFee;

      return json(200, {
        success: true,
        paymentIntentId: paymentIntent.id,
        dteProcessed: true,
        fees: {
          stripe: stripeFee / 100,
          yourFee: yourFee / 100,
          netAmount: netAmount / 100,
        },
        message: 'Pago procesado exitosamente. DTE listo para transmitir a Hacienda.',
      }, corsHeaders(event));
    }

    return json(400, { 
      error: 'Pago no completado', 
      status: paymentIntent.status 
    }, corsHeaders(event));

  } catch (error) {
    console.error('Error en procesamiento Stripe:', error);
    return json(500, { 
      error: 'Error procesando pago',
      details: error.message 
    }, corsHeaders(event));
  }
};

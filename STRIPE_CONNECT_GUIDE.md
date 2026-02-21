# Guía Stripe Connect para tu SaaS DTE

## ¿Qué es Stripe Connect?

Stripe Connect te permite procesar pagos para terceros (tus clientes) a través de tu plataforma. Cada cliente tiene su "cuenta conectada" y Stripe liquida directamente a ellos.

## Flujo completo para tu SaaS DTE

### 1. Registro del cliente en tu plataforma
```javascript
// Cuando un nuevo cliente se registra
const connectedAccount = await stripe.accounts.create({
  type: 'express',
  country: 'US', // Temporal hasta que Stripe opere en SV
  email: 'cliente@ejemplo.com',
  capabilities: {
    card_payments: { requested: true },
    transfers: { requested: true },
  },
  business_profile: {
    name: 'Mi Tienda S.A. de C.V.',
    product_description: 'Venta de productos y servicios',
  },
});
```

### 2. Onboarding del cliente
```javascript
// Generar link para que cliente complete su perfil
const accountLink = await stripe.accountLinks.create({
  account: connectedAccount.id,
  refresh_url: 'https://tu-app.com/reauth',
  return_url: 'https://tu-app.com/success',
  type: 'account_onboarding',
});
```

### 3. Procesar pago con comisiones
```javascript
// Al procesar un pago de $20
const paymentIntent = await stripe.paymentIntents.create({
  amount: 2260, // $20 + IVA 13%
  currency: 'usd',
  payment_method: pm_id,
  confirm: true,
  transfer_data: {
    destination: connectedAccount.id,
    amount: 2130, // $21.30 - 13¢ comisión tuya
  },
  application_fee_amount: 130, // $1.30 tu comisión (5.5% + $0.10)
});
```

## Requisitos para Stripe Connect

### Para ti (plataforma)
- ✅ Cuenta Stripe en país soportado (US/EU)
- ✅ Verificación de identidad
- ✅ Modelo de negocio claro (SaaS + procesamiento pagos)

### Para tus clientes
- ✅ Cuenta bancaria (SV o US)
- ✅ Documento de identidad
- ✅ Información del negocio

## Comisiones transparentes

### Ejemplo venta de $20

| Concepto | Monto |
|----------|-------|
| Precio producto | $20.00 |
| IVA 13% | $2.60 |
| Total cliente | $22.60 |
| | |
| Comisión Stripe | $1.32 |
| Comisión plataforma | $1.30 |
| | |
| Neto cliente | $19.98 |

## Pasos para implementar

### 1. Crear cuenta Stripe Connect
- Ve a [dashboard.stripe.com/connect](https://dashboard.stripe.com/connect)
- Selecciona "Express" o "Custom"
- Completa verificación de plataforma

### 2. Configurar tu plataforma
```javascript
// En tu backend
const stripe = require('stripe')(process.env.STRIPE_PLATFORM_SECRET_KEY);
```

### 3. Integrar en tu flujo DTE
- Ya está integrado en `stripe-payment.cjs`
- Solo falta configurar `connectedAccountId`

## Consideraciones legales El Salvador

### Mientras Stripe no opera directamente en SV:
- Tus clientes necesitan:
  - Cuenta bancaria SV (para recibir fondos)
  - Cuenta Stripe US (para procesar)
  - O usas tu cuenta como intermediario

### Alternativa híbrida:
```javascript
// Tú recibes todo, luego liquidas manualmente
const paymentIntent = await stripe.paymentIntents.create({
  amount: 2260,
  currency: 'usd',
  // Sin transfer_data
});

// Tú liquidas semanalmente a tus clientes
```

## Próximos pasos

1. **Crea cuenta Stripe estándar** (ya puedes empezar)
2. **Prueba con tarjetas de prueba** (4242 4242 4242 4242)
3. **Cuando tengas 10+ clientes**, activa Connect
4. **Considera alternativas locales** (Wompi, Pagadito) si hay restricciones

## Soporte
- Documentación Stripe: [stripe.com/docs/connect](https://stripe.com/docs/connect)
- Ejemplos para Node.js: [github.com/stripe-samples](https://github.com/stripe-samples)

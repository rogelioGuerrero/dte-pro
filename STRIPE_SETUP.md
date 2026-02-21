# Configuración de Variables de Entorno - Stripe

## Variables requeridas en Netlify

Agrega estas variables en el dashboard de Netlify (Site settings > Build & deploy > Environment):

### Para desarrollo (sandbox/test)
```
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

### Para producción (cuando tengas cuenta real)
```
STRIPE_SECRET_KEY=sk_live_...
STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

## Pasos para obtener las claves

1. **Crea cuenta Stripe** (temporal en US por ahora)
   - Ve a [dashboard.stripe.com](https://dashboard.stripe.com)
   - Regístrate con email y contraseña

2. **Obtén claves de prueba**
   - En dashboard → Developers → API keys
   - Copia la "Secret key" (empieza con sk_test_)
   - Copia la "Publishable key" (empieza con pk_test_)

3. **Configura webhook**
   - Dashboard → Developers → Webhooks
   - Añade endpoint: `https://tu-site.netlify.app/api/stripe/webhook`
   - Selecciona eventos: `payment_intent.succeeded`, `payment_intent.payment_failed`

## Variables adicionales (opcionales)
```
ALLOWED_ORIGINS=http://localhost:8888,http://localhost:5173,https://tu-site.netlify.app
```

## Para Stripe Connect (futuro)

Cuando tengas cuenta Connect, añade:
```
STRIPE_CLIENT_ID=ca_...
STRIPE_CLIENT_SECRET=sk_...
STRIPE_PLATFORM_SECRET_KEY=sk_...
```

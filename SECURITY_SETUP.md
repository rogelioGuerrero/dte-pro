# Configuración de Seguridad - DTE Pro

## Variables de Entorno Requeridas

### 1. Variables Locales (`.env.local`)
Estas variables se configuran localmente para desarrollo:

```bash
# PIN de administrador para acceder a Configuración Avanzada
# Debe ser un PIN seguro de 6-8 dígitos
VITE_ADMIN_PIN=TU_PIN_SEGURO_AQUI
```

### 2. Variables de Netlify (Panel de Netlify > Site Settings > Environment Variables)

#### Variables Esenciales
```bash
# Contraseña para generar licencias
ADMIN_PASSWORD=TuContraseñaMuySegura123

# Llave privada para firmar licencias (contenido completo del archivo .pem)
LICENSE_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC...
-----END PRIVATE KEY-----

# URL base para generar links mágicos
URL=https://tudominio.com
```

#### Variables Opcionales (2FA)
```bash
# Secreto TOTP para autenticación de dos factores
# Generar con: node -e "console.log(require('otpauth').Secret().base32)"
ADMIN_TOTP_SECRET=JBSWY3DPEHPK3PXP
```

#### Variables de Licenciamiento
```bash
# Activar sistema de límites
LICENSING_ENABLED=true

# Límite gratuito de DTEs por día
DAILY_EXPORT_LIMIT=5
```

## Flujo de Seguridad Implementado

### 1. Acceso a Configuración Avanzada
- 5 clics en el logo → abre modal
- Requiere PIN (`VITE_ADMIN_PIN`)
- Si 2FA activado → requiere código TOTP

### 2. Generación de Licencias
- Requiere contraseña (`ADMIN_PASSWORD`)
- Rate limiting: 5 intentos cada 15 minutos
- Si 2FA activado → requiere código TOTP adicional
- Validación siempre en servidor (sin bypass cliente)

### 3. Verificación 2FA
- Usa librería `otpauth` (frontend y backend)
- Ventana de tolerancia: 1 período (30s)
- Algoritmo SHA1, 6 dígitos, período 30s

## Verificación de Configuración

### 1. Verificar variables locales
```bash
# En la consola del navegador
console.log('PIN:', import.meta.env.VITE_ADMIN_PIN);
```

### 2. Verificar variables de Netlify
```bash
# Test de función
curl -X POST https://tudominio.netlify.app/.netlify/functions/admin-generate-license \
  -H "Content-Type: application/json" \
  -d '{"action":"verify-access","password":"test"}'
```

### 3. Verificar 2FA
```bash
# Generar código TOTP de prueba
node -e "
const { TOTP, Secret } = require('otpauth');
const secret = 'JBSWY3DPEHPK3PXP';
const totp = new TOTP({ secret: Secret.fromBase32(secret) });
console.log('Código actual:', totp.generate());
"
```

## Mejores Prácticas

### 1. Contraseñas
- Mínimo 12 caracteres
- Incluir mayúsculas, minúsculas, números y símbolos
- No usar palabras comunes o información personal

### 2. Llaves Privadas
- Nunca commit al repositorio
- Guardar solo en Netlify (variables de entorno)
- Rotar cada 6-12 meses

### 3. 2FA
- Usar app autenticadora (Google Authenticator, Authy)
- Guardar secretos de recuperación seguros
- Rotar secreto si se compromete

### 4. Rate Limiting
- Configurado: 5 intentos cada 15 minutos
- Monitorear logs de intentos fallidos
- Considerar VPNs o IPs estáticas para admin

## Troubleshooting

### "PIN incorrecto"
- Verificar `VITE_ADMIN_PIN` en `.env.local`
- Reiniciar servidor de desarrollo
- Limpiar localStorage: `localStorage.clear()`

### "Contraseña incorrecta"
- Verificar `ADMIN_PASSWORD` en Netlify
- Esperar 2 minutos después de cambios
- Revisar espacios o caracteres especiales

### "Código 2FA incorrecto"
- Sincronizar tiempo del dispositivo
- Verificar `ADMIN_TOTP_SECRET` coincide
- Usar ventana de 1 período (30s antes/después)

### "Demasiados intentos"
- Esperar 15 minutos
- Verificar IP correcta
- Revisar logs de Netlify

## Seguridad Adicional Recomendada

1. **IP Whitelisting**: Configurar acceso solo desde IPs conocidas
2. **Audit Logs**: Registrar todos los intentos de acceso
3. **Alertas**: Notificaciones por múltiples intentos fallidos
4. **Backup**: Respaldar configuración de 2FA y llaves privadas

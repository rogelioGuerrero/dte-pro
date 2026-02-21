# Sistema de Licencias DTE Pro

Este documento explica cómo funciona y cómo configurar el sistema de licencias para monetizar la aplicación DTE Pro.

## 🎯 Concepto

El sistema utiliza **criptografía asimétrica** para generar licencias sin necesidad de una base de datos centralizada. Las licencias se firman digitalmente con una llave privada que solo tú tienes, y la aplicación las valida usando una llave pública incrustada.

## 🔄 Flujo de Activación (Para Clientes)

1.  **Límite Gratuito:** El usuario puede emitir **5 DTEs por día** sin licencia.
2.  **Solicitud de Licencia:** Al alcanzar el límite, la app muestra un **Código de Dispositivo** único.
3.  **Envío del Código:** El cliente te envía ese código por WhatsApp/Email.
4.  **Generación de Licencia:** Tú generas la licencia usando la interfaz web (`/admin`) o el script local.
5.  **Activación:** El cliente activa la licencia usando:
    *   **Opción A (Recomendada):** Un **Link Mágico** que activa la app al abrirlo.
    *   **Opción B:** Un **Código de Texto** que pega en la app.
    *   **Opción C:** Subiendo un archivo `.json` (método antiguo).

## 🛠️ Configuración Inicial (Administrador)

### Paso 1: Generar Llaves (Solo una vez)
Si no tienes las llaves, ejecuta:
```bash
cd scripts
node generate-license.mjs generate-keys
```
Esto creará:
- `scripts/private-key.pem` (¡NUNCA COMPARTIR!)
- `scripts/public-key.pem` (Pública, ya está en la app)

### Paso 2: Configurar Variables de Entorno en Netlify
Ve a tu panel de Netlify > Site configuration > Environment variables y agrega:

#### Variables de Licenciamiento
- `LICENSING_ENABLED` = `true` (Activa el sistema de límites)
- `DAILY_EXPORT_LIMIT` = `5` (Límite gratuito por día)
- `ADMIN_PASSWORD` = `TuContraseñaSegura` (Para acceder al generador de licencias)
- `ADMIN_TOTP_SECRET` = (Opcional) Secreto TOTP para 2FA

#### Variables de la Interfaz Web
- `LICENSE_PRIVATE_KEY` = (Contenido completo del archivo `scripts/private-key.pem`)
- `URL` = `https://tudominio.com` (Para generar los links mágicos)

#### Variables Locales (.env.local)
- `VITE_ADMIN_PIN` = `TU_PIN_SEGURO` (Para acceder a Configuración Avanzada)

### Paso 3: Acceder al Generador de Licencias
1.  Despliega los cambios a Netlify.
2.  Abre la aplicación y haz clic 5 veces en el logo.
3.  Ingresa el PIN de administrador (VITE_ADMIN_PIN).
4.  Ve a la pestaña "Licencias" en Configuración Avanzada.
5.  Ingresa la contraseña que configuraste en `ADMIN_PASSWORD`.

## 🎛️ Uso del Panel de Administración

El panel `/admin` te permite generar licencias de forma sencilla:

1.  **Email del Cliente:** Opcional, para tu control.
2.  **Nombre/Empresa:** Opcional.
3.  **Fingerprint (ID Dispositivo):** **Obligatorio**. Pega el código que te envió el cliente.
4.  **Días de Validez:** Cuántos días dura la licencia (365 por defecto).
5.  **Límite Diario:** Cuántos DTEs puede emitir por día (-1 = ilimitado).

Al generar, obtendrás:
- **Link Mágico:** Ideal para enviar por WhatsApp.
- **Código de Texto:** Como respaldo si el link falla.

## 📱 Flujo para el Usuario Final

### Cuando el usuario necesita licencia:
1.  Va a la app y ve el mensaje "Límite alcanzado".
2.  Toca "Activar Licencia" y copia su **Código de Dispositivo**.
3.  Te envía ese código por WhatsApp.

### Cuando tú le respondes:
1.  Entras a `https://tudominio.com/admin`.
2.  Pegas su código en "Fingerprint".
3.  Configuras validez y límites según el plan que compró.
4.  Le das "Generar Licencia".
5.  Le envías el **Link Mágico** por WhatsApp.

### Cuando el cliente recibe tu respuesta:
1.  Toca el link que le enviaste.
2.  La app se abre automáticamente y muestra "¡Licencia Activada!".
3.  Ya puede emitir DTEs sin límites.

## 🔐 Seguridad

- La **llave privada** nunca sale de tu servidor Netlify.
- Las licencias están **atadas al dispositivo** (no funcionan en otro teléfono).
- Las licencias **expiran** según la fecha que configures.
- No hay base de datos, todo funciona con criptografía matemática.

## 📋 Comandos de Emergencia (Si la UI falla)

Si por alguna razón no puedes usar la interfaz web, puedes generar licencias manualmente:

```bash
# Modo interactivo (recomendado)
cd scripts
node generate-license.mjs generate

# Modo avanzado (con flags)
node generate-license.mjs generate --email cliente@ejemplo.com --days 365 --exports 100 --device "ID-DEL-DISPOSITIVO"
```

## 🚀 Activación del Sistema

Para activar el sistema de límites:
1.  Configura las variables de entorno en Netlify.
2.  Cambia `LICENSING_ENABLED` a `true`.
3.  Redespliega el sitio.

Para desactivarlo temporalmente (mantenimiento), cambia `LICENSING_ENABLED` a `false`.

El sistema utiliza **criptografía asimétrica** para validar licencias offline:
- **Llave Privada**: Solo tú la tienes. Firma las licencias.
- **Llave Pública**: Está en la app. Verifica que las licencias sean auténticas.

## � Control de Licenciamiento (Toggle)

La aplicación incluye un interruptor en **Configuración Avanzada** que permite:
- **✅ Activado (Producción)**: Aplica validación de licencias y límites
- **❌ Desactivado (Desarrollo)**: Uso ilimitado sin necesidad de licencia

### ¿Cómo acceder?
1. Haz clic 5 veces en el logo DTE Pro
2. Ingresa el PIN de administrador (configurado en VITE_ADMIN_PIN)
3. Ve a "Gestión de Licencias"
4. Activa/desactiva "Activar Licenciamiento"

### ¿Cuándo usarlo desactivado?
- **Desarrollo**: Para probar sin restricciones
- **Demostraciones**: Para mostrar funcionalidad completa
- **Versiones internas**: Para tu equipo
- **Testing**: Para simular diferentes escenarios

## �🚀 Configuración Inicial

### 1. Generar llaves criptográficas
```bash
cd scripts
node setup-license.mjs
```

Esto generará:
- `private-key.pem` - ¡GUARDAR SEGURO! Nunca compartir.
- `public-key.pem` - Llave pública en formato PEM
- `public-key.jwk` - Llave pública en formato para la web

### 2. Actualizar la aplicación
El script de configuración automáticamente actualiza `utils/licenseValidator.ts` con la llave pública.

## 💰 Generación de Licencias

### Comandos básicos
```bash
# Generar licencia por 1 año
node generate-license.mjs generate --email cliente@ejemplo.com

# Licencia personalizada
node generate-license.mjs generate \
  --email cliente@ejemplo.com \
  --company "Mi Empresa S.A. de C.V." \
  --days 365 \
  --exports 100

# Verificar licencia
node generate-license.mjs verify license-user-123.json
```

### Opciones disponibles
- `--email <correo>`: Email del usuario
- `--company <nombre>`: Nombre de la empresa
- `--days <número>`: Días de validez (defecto: 365)
- `--exports <número>`: Límite de exportaciones diarias (-1 = ilimitado)

## 🔧 Integración con la App

### Componentes
- `LicenseManager.tsx`: Modal para activar licencia
- `LicenseStatus.tsx`: Indicador visual de estado
- `licenseValidator.ts`: Lógica de validación
- `usageLimit.ts`: Control de exportaciones

### Flujo del usuario
1. Usuario usa app con límite gratuito (5 exportaciones/día)
2. Puede activar licencia cargando archivo `.json`
3. La licencia se valida offline usando Web Crypto API
4. Se guarda en IndexedDB para uso futuro

## 💡 Modelos de Monetización Sugeridos

### 1. Licencia Perpetua
- **Precio**: $99 USD
- **Incluye**: Uso ilimitado, actualizaciones por 1 año
- **Renovación**: $29/año para actualizaciones

### 2. Licencias por Volumen
- **Básica**: $49 - 50 exportaciones/día
- **Profesional**: $99 - 200 exportaciones/día
- **Empresarial**: $199 - Ilimitadas

### 3. Suscripción Anual (si decides cambiar)
- **Mensual**: $9/mes
- **Anual**: $99/año (2 meses gratis)

## 🛡️ Seguridad

### ¿Qué tan seguro es?
- ✅ **Firmas inviolables**: Nadie puede generar licencias sin tu llave privada
- ⚠️ **Código modificable**: Un programador podría saltarse la validación
- 💡 **Mitigación**: Ofuscación de código y precio accesible

### Mejores prácticas
1. **Guarda secure tu llave privada** (private-key.pem)
2. **Usa ofuscación** para dificultar ingeniería inversa
3. **Precio accesible** para desincentivar pirateo
4. **Ofrece soporte prioritario** a clientes pagos

## 📋 Proceso de Venta

### Opción 1: Manual
1. Cliente te contacta y paga (transferencia, PayPal, etc.)
2. Generas licencia con sus datos
3. Envías archivo JSON por email

### Opción 2: Automatizado (futuro)
- Integrar con **Gumroad** o **LemonSqueezy**
- API que genera licencias automáticamente al pagar
- Webhook para entrega instantánea

### Opción 3: Backend Mínimo
- Una Cloud Function para generar licencias
- Base de datos simple para registrar ventas
- No es SaaS completo, solo validación

## 🔍 Troubleshooting

### "Licencia inválida o manipulada"
- Verifica que el archivo JSON no fue modificado
- Asegúrate de usar la llave pública correcta

### "Licencia expirada"
- La fecha del sistema es correcta
- Generar nueva licencia con fecha futura

### "Límite de exportaciones alcanzado"
- Para usuarios sin licencia: 5 por día
- Para usuarios con licencia: según configuración
- Se reinicia cada día a medianoche

## 📝 Notas Técnicas

### Formato del archivo de licencia
```json
{
  "data": {
    "id": "uuid-único",
    "userId": "user-123",
    "issuedAt": "2024-01-01T00:00:00.000Z",
    "expiresAt": "2025-01-01T00:00:00.000Z",
    "maxExports": 100,
    "features": ["basic"],
    "email": "cliente@ejemplo.com",
    "companyName": "Mi Empresa",
    "version": "1.0"
  },
  "signature": "firma-base64-sha256-ecdsa"
}
```

### Almacenamiento
- Licencias guardadas en `localStorage` como `dte-license`
- Contador de exportaciones en `exports-YYYY-MM-DD`
- Compatible con IndexedDB para futuras mejoras

## 🚀 Próximos Pasos

1. **Configurar sistema**: Ejecutar `setup-license.mjs`
2. **Probar**: Generar licencia de prueba
3. **Definir precios**: Según tu mercado
4. **Crear canal de venta**: Email, web, etc.
5. **Documentar soporte**: FAQ y contacto

---

¿Necesitas ayuda implementando alguna parte específica?

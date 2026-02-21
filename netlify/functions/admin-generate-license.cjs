const crypto = require('crypto');

// Rate limiting simple en memoria
const rateLimitStore = new Map();

function checkRateLimit(ip, maxAttempts = 5, windowMs = 15 * 60 * 1000) {
  const now = Date.now();
  const attempts = rateLimitStore.get(ip) || { count: 0, resetTime: now + windowMs };
  
  if (now > attempts.resetTime) {
    // Resetear ventana de tiempo
    attempts.count = 0;
    attempts.resetTime = now + windowMs;
  }
  
  attempts.count++;
  rateLimitStore.set(ip, attempts);
  
  // Limpiar entradas viejas periódicamente
  if (Math.random() < 0.01) {
    for (const [key, value] of rateLimitStore.entries()) {
      if (now > value.resetTime) {
        rateLimitStore.delete(key);
      }
    }
  }
  
  return attempts.count <= maxAttempts;
}

exports.handler = async function(event, context) {
  // Solo permitir POST
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  // Obtener IP para rate limiting
  const clientIP = event.headers['x-forwarded-for'] || 
                   event.headers['x-real-ip'] || 
                   event.requestContext.identity.sourceIp || 
                   'unknown';

  try {
    const body = JSON.parse(event.body);
    const { password, totpCode, action, licenseData } = body;

    // Verificar rate limiting
    if (!checkRateLimit(clientIP)) {
      return {
        statusCode: 429,
        headers: { 'Retry-After': '900' }, // 15 minutos
        body: JSON.stringify({ error: 'Demasiados intentos. Intente nuevamente en 15 minutos.' })
      };
    }

    // 1. Verificar contraseña maestra
    const adminPassword = process.env.ADMIN_PASSWORD;
    const adminTotpSecret = process.env.ADMIN_TOTP_SECRET;
    
    if (!adminPassword || password !== adminPassword) {
      return {
        statusCode: 401,
        body: JSON.stringify({ error: 'Contraseña de administrador incorrecta' })
      };
    }

    // 2. Si es acción de verificación, manejar 2FA
    if (action === 'verify-access') {
      // Si 2FA está configurado en servidor, requerir código
      if (adminTotpSecret) {
        return {
          statusCode: 401,
          body: JSON.stringify({ 
            requires2FA: true,
            error: 'Se requiere código 2FA' 
          })
        };
      }
      // Sin 2FA, acceso permitido
      return {
        statusCode: 200,
        body: JSON.stringify({ success: true })
      };
    }

    // 3. Si es acción con 2FA, verificar código
    if (action === 'verify-access-2fa') {
      if (!adminTotpSecret) {
        return {
          statusCode: 400,
          body: JSON.stringify({ error: '2FA no configurado en servidor' })
        };
      }

      const isValidTotp = verifyTOTP(totpCode, adminTotpSecret);
      if (!isValidTotp) {
        return {
          statusCode: 401,
          body: JSON.stringify({ error: 'Código 2FA incorrecto' })
        };
      }

      return {
        statusCode: 200,
        body: JSON.stringify({ success: true })
      };
    }

    // 4. Si no es acción de verificación, proceder con generación de licencia
    // Verificar 2FA si está configurado
    if (adminTotpSecret) {
      if (!totpCode || !verifyTOTP(totpCode, adminTotpSecret)) {
        return {
          statusCode: 401,
          body: JSON.stringify({ error: 'Se requiere código 2FA válido para generar licencias' })
        };
      }
    }

    // 5. Verificar llave privada
    const privateKey = process.env.LICENSE_PRIVATE_KEY;
    if (!privateKey) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Llave privada no configurada en el servidor' })
      };
    }

    // 3. Preparar datos de la licencia
    // Asegurar valores por defecto y estructura
    const now = new Date();
    const expiresAt = licenseData.expiresAt ? new Date(licenseData.expiresAt) : new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
    
    const finalLicenseData = {
      id: crypto.randomUUID(),
      userId: licenseData.userId || 'user-' + Math.random().toString(36).substr(2, 9),
      issuedAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      maxExports: typeof licenseData.maxExports === 'number' ? licenseData.maxExports : -1,
      features: licenseData.features || ['basic'],
      email: licenseData.email || '',
      companyName: licenseData.companyName || '',
      deviceFingerprint: licenseData.deviceFingerprint || null,
      version: '1.0'
    };

    // 4. Firmar licencia
    const sign = crypto.createSign('SHA256');
    sign.update(JSON.stringify(finalLicenseData));
    
    // Normalizar llave privada: manejar \n literales y asegurar formato PEM correcto
    let normalizedKey = privateKey.trim();
    
    // 1. Manejar saltos de línea escapados (ej: variables de entorno en una línea)
    if (normalizedKey.includes('\\n')) {
      normalizedKey = normalizedKey.replace(/\\n/g, '\n');
    }
    
    // 2. Si después de lo anterior sigue sin tener saltos de línea reales (y parece tener headers)
    if (!normalizedKey.includes('\n') && normalizedKey.includes('PRIVATE KEY')) {
        // Extraer el cuerpo limpiando headers y espacios
        const body = normalizedKey
            .replace(/-----BEGIN [A-Z ]+-----/, '')
            .replace(/-----END [A-Z ]+-----/, '')
            .replace(/\s/g, ''); // Quitar espacios internos
            
        // Reconstruir formato PEM estándar
        normalizedKey = `-----BEGIN PRIVATE KEY-----\n${body}\n-----END PRIVATE KEY-----`;
    }
    
    const signature = sign.sign(normalizedKey, 'base64');

    const license = {
      data: finalLicenseData,
      signature
    };

    // 5. Generar formatos extra (Base64 y Link)
    const licenseBase64 = Buffer.from(JSON.stringify(license)).toString('base64');
    
    // URL base desde variable o default
    const appUrl = process.env.URL || 'https://factura.mishacienda.sv'; 
    const magicLink = `${appUrl}/?license=${licenseBase64}`;

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        license,
        licenseBase64,
        magicLink
      })
    };

  } catch (error) {
    console.error('Error generating license:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Error interno generando la licencia: ' + error.message })
    };
  }
};

const { TOTP, Secret } = require('otpauth');

// Función para verificar TOTP real usando otpauth
function verifyTOTP(token, secret) {
  if (!token || !secret) return false;
  
  try {
    const totp = new TOTP({
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      secret: Secret.fromBase32(secret)
    });

    const delta = totp.validate({ token, window: 1 });
    return delta !== null;
  } catch (error) {
    console.error('Error verificando TOTP:', error);
    return false;
  }
}

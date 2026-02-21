import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import readline from 'readline';

// Crear interfaz para leer input del usuario
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Función para hacer preguntas
function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

// Generar par de llaves (ejecutar solo una vez)
function generateKeyPair() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ec', {
    namedCurve: 'P-256',
    publicKeyEncoding: { 
      type: 'spki', 
      format: 'pem' 
    },
    privateKeyEncoding: { 
      type: 'pkcs8', 
      format: 'pem' 
    }
  });

  // Guardar llaves
  fs.writeFileSync('private-key.pem', privateKey);
  fs.writeFileSync('public-key.pem', publicKey);
  
  // Convertir llave pública a JWK para la web
  const publicKeyJwk = exportPublicKeyToJWK(publicKey);
  fs.writeFileSync('public-key.jwk', JSON.stringify(publicKeyJwk, null, 2));
  
  console.log('✅ Llaves generadas:');
  console.log('🔐 Private: private-key.pem (¡NUNCA COMPARTIR!)');
  console.log('🔓 Public: public-key.pem / public-key.jwk');
}

// Exportar llave pública a formato JWK (JSON Web Key)
function exportPublicKeyToJWK(pemPublicKey) {
  const publicKeyObject = crypto.createPublicKey(pemPublicKey);
  const jwk = publicKeyObject.export({ format: 'jwk' });
  return jwk;
}

// Generar licencia de forma interactiva
async function generateLicenseInteractive() {
  console.log('\n📝 Generador de Licencias - Modo Interactivo\n');
  
  try {
    const email = await question('📧 Email del usuario: ');
    const company = await question('🏢 Nombre de la empresa (opcional, Enter para omitir): ');
    const daysInput = await question('⏰ Días de validez (defecto: 365): ');
    const exportsInput = await question('📊 Límite de exportaciones por día (defecto: -1 = ilimitado): ');
    
    const options = {};
    
    if (email.trim()) options.email = email.trim();
    if (company.trim()) options.companyName = company.trim();
    if (daysInput.trim()) {
      const days = parseInt(daysInput);
      if (!isNaN(days) && days > 0) {
        options.expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
      }
    }
    if (exportsInput.trim()) {
      const exports = parseInt(exportsInput);
      if (!isNaN(exports) && exports >= -1) {
        options.maxExports = exports;
      }
    }
    
    console.log('\n⏳ Generando licencia...\n');
    const filename = generateLicense(options);
    
    console.log('\n✅ ¡Licencia generada exitosamente!');
    console.log(`📁 Archivo: ${filename}`);
    console.log('💡 Ahora puedes enviar este archivo al usuario para que lo active en la app.\n');
    
  } catch (error) {
    console.error('\n❌ Error generando licencia:', error.message);
  }
}
function generateLicense(options = {}) {
  const {
    userId = 'user-' + Math.random().toString(36).substr(2, 9),
    expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 año por defecto
    maxExports = -1, // -1 = ilimitado
    features = ['basic'],
    email = '',
    companyName = '',
    deviceFingerprint = null // Nuevo campo para fingerprint del dispositivo
  } = options;

  // Datos de la licencia
  const licenseData = {
    id: crypto.randomUUID(),
    userId,
    issuedAt: new Date().toISOString(),
    expiresAt: new Date(expiresAt).toISOString(),
    maxExports,
    features,
    email,
    companyName,
    deviceFingerprint, // Guardar fingerprint si se proporciona
    version: '1.0'
  };

  // Firmar los datos
  const privateKey = fs.readFileSync('private-key.pem', 'utf8');
  const sign = crypto.createSign('SHA256');
  sign.update(JSON.stringify(licenseData));
  const signature = sign.sign(privateKey, 'base64');

  // Licencia completa
  const license = {
    data: licenseData,
    signature
  };

  // Guardar archivo de licencia
  const filename = `license-${userId}-${Date.now()}.json`;
  const licenseJsonStr = JSON.stringify(license, null, 2);
  fs.writeFileSync(filename, licenseJsonStr);
  
  // Generar código Base64
  const licenseBase64 = Buffer.from(JSON.stringify(license)).toString('base64');
  
  // Generar URL mágica (ajustar dominio según necesidad, por defecto localhost o ejemplo)
  const baseUrl = 'https://factura.mishacienda.sv'; // O el dominio que use el cliente
  const magicLink = `${baseUrl}/?license=${licenseBase64}`;

  console.log(`✅ Licencia generada: ${filename}`);
  console.log(`📧 Usuario: ${email || userId}`);
  console.log(`⏰ Expira: ${licenseData.expiresAt}`);
  console.log(`📊 Exportaciones: ${maxExports === -1 ? 'Ilimitadas' : maxExports}`);
  if (deviceFingerprint) {
    console.log(`🖥️  Fingerprint: ${deviceFingerprint.substring(0, 16)}...`);
  }
  
  console.log('\n📋 CÓDIGO DE ACTIVACIÓN (Copiar y enviar):');
  console.log('----------------------------------------');
  console.log(licenseBase64);
  console.log('----------------------------------------');

  console.log('\n🔗 LINK MÁGICO (Opcional):');
  console.log(magicLink);
  console.log('');
  
  return filename;
}

// Verificar licencia (para testing)
function verifyLicense(licenseFile) {
  try {
    const license = JSON.parse(fs.readFileSync(licenseFile, 'utf8'));
    const publicKey = fs.readFileSync('public-key.pem', 'utf8');
    
    const verify = crypto.createVerify('SHA256');
    verify.update(JSON.stringify(license.data));
    const isValid = verify.verify(publicKey, license.signature, 'base64');
    
    if (isValid) {
      console.log('✅ Licencia válida');
      console.log(`📅 Expira: ${license.data.expiresAt}`);
      console.log(`🆔 Usuario: ${license.data.userId}`);
      
      // Verificar expiración
      if (new Date(license.data.expiresAt) < new Date()) {
        console.log('⚠️ ¡Licencia expirada!');
      }
    } else {
      console.log('❌ Licencia inválida o manipulada');
    }
  } catch (error) {
    console.error('❌ Error verificando licencia:', error.message);
  }
}

// CLI
const command = process.argv[2];

// Función principal asíncrona
async function main() {
  switch (command) {
    case 'generate-keys':
      generateKeyPair();
      break;
      
    case 'generate':
      // Si hay flags, usar modo antiguo
      if (process.argv.includes('--email') || process.argv.includes('--company') || 
          process.argv.includes('--days') || process.argv.includes('--exports')) {
        const options = {};
        if (process.argv.includes('--email')) {
          const emailIndex = process.argv.indexOf('--email') + 1;
          options.email = process.argv[emailIndex];
        }
        if (process.argv.includes('--company')) {
          const companyIndex = process.argv.indexOf('--company') + 1;
          options.companyName = process.argv[companyIndex];
        }
        if (process.argv.includes('--days')) {
          const daysIndex = process.argv.indexOf('--days') + 1;
          const days = parseInt(process.argv[daysIndex]);
          options.expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
        }
        if (process.argv.includes('--exports')) {
          const exportsIndex = process.argv.indexOf('--exports') + 1;
          options.maxExports = parseInt(process.argv[exportsIndex]);
        }
        generateLicense(options);
      } else {
        // Modo interactivo por defecto
        await generateLicenseInteractive();
      }
      break;
      
    case 'verify':
      const file = process.argv[3];
      if (file) {
        verifyLicense(file);
      } else {
        console.log('❌ Especifica el archivo de licencia: node generate-license.mjs verify archivo.json');
      }
      break;
      
    default:
      console.log(`
🔐 Generador de Licencias DTE

Comandos:
  generate-keys           Generar nuevo par de llaves (ejecutar solo una vez)
  generate                Generar nueva licencia (modo interactivo)
  generate [options]      Generar licencia con opciones (modo avanzado)
  verify <archivo>        Verificar licencia

Opciones para generate (modo avanzado):
  --email <correo>        Email del usuario
  --company <nombre>      Nombre de la empresa
  --days <número>         Días de validez (defecto: 365)
  --exports <número>      Límite de exportaciones (-1 = ilimitado)

Ejemplos:
  node generate-license.mjs generate-keys
  node generate-license.mjs generate              (Modo interactivo)
  node generate-license.mjs generate --email usuario@ejemplo.com --days 365 --exports 100
  node generate-license.mjs verify license-user-123.json
      `);
  }
  
  // Cerrar readline si se usó
  rl.close();
}

// Ejecutar main
main().catch(error => {
  console.error('❌ Error:', error.message);
  rl.close();
});

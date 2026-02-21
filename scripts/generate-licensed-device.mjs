import crypto from 'crypto';
import fs from 'fs';
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

// Generar licencia atada a un fingerprint específico
async function generateLicensedDevice() {
  console.log('\n🖥️  Generador de Licencia para Dispositivo Específico\n');
  console.log('⚠️  Esta licencia solo funcionará en la máquina donde se generó el fingerprint\n');
  
  try {
    // Pedir el fingerprint generado por la aplicación
    const fingerprint = await question('🔑 Fingerprint del dispositivo: ');
    
    if (!fingerprint.trim()) {
      console.log('\n❌ El fingerprint es obligatorio');
      rl.close();
      return;
    }

    // Pedir datos del usuario
    const email = await question('📧 Email del usuario: ');
    const company = await question('🏢 Nombre de la empresa (opcional): ');
    const daysInput = await question('⏰ Días de validez (defecto: 365): ');
    const exportsInput = await question('📊 Límite de exportaciones por día (defecto: -1 = ilimitado): ');
    
    const options = {
      deviceFingerprint: fingerprint.trim(),
      userId: 'device-' + Math.random().toString(36).substr(2, 9)
    };
    
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
    
    console.log('\n⏳ Generando licencia vinculada al dispositivo...\n');
    
    // Usar la misma función de generate-license.mjs
    const { generateLicense } = await import('./generate-license.mjs');
    const filename = generateLicense(options);
    
    console.log('\n✅ ¡Licencia generada exitosamente!');
    console.log(`📁 Archivo: ${filename}`);
    console.log('🔒 Esta licencia solo funcionará en el dispositivo con el fingerprint proporcionado');
    console.log('💡 Envía este archivo al usuario para que lo active en su dispositivo\n');
    
  } catch (error) {
    console.error('\n❌ Error generando licencia:', error.message);
  }
  
  rl.close();
}

// Generar licencia sin fingerprint (móvil - para testing)
async function generateMobileLicense() {
  console.log('\n📱 Generador de Licencia para Móvil (Sin Fingerprint)\n');
  console.log('⚠️  Esta licencia podrá ser transferida entre dispositivos\n');
  
  try {
    const email = await question('📧 Email del usuario: ');
    const company = await question('🏢 Nombre de la empresa (opcional): ');
    const daysInput = await question('⏰ Días de validez (defecto: 365): ');
    const exportsInput = await question('📊 Límite de exportaciones por día (defecto: -1 = ilimitado): ');
    
    const options = {
      userId: 'mobile-' + Math.random().toString(36).substr(2, 9)
    };
    
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
    
    console.log('\n⏳ Generando licencia móvil...\n');
    
    const { generateLicense } = await import('./generate-license.mjs');
    const filename = generateLicense(options);
    
    console.log('\n✅ ¡Licencia móvil generada exitosamente!');
    console.log(`📁 Archivo: ${filename}`);
    console.log('🔄 Esta licencia puede ser transferida entre dispositivos\n');
    
  } catch (error) {
    console.error('\n❌ Error generando licencia:', error.message);
  }
  
  rl.close();
}

// CLI
const command = process.argv[2];

switch (command) {
  case 'device':
    generateLicensedDevice();
    break;
    
  case 'mobile':
    generateMobileLicense();
    break;
    
  default:
    console.log(`
🖥️  Generador de Licencias de Dispositivo

Comandos:
  device                  Generar licencia atada a un dispositivo específico
  mobile                  Generar licencia móvil (transferible)

Uso:
  1. Ejecuta la aplicación web
  2. Ve a la consola del navegador y ejecuta: 
     await import('./utils/deviceFingerprint.js').then(m => m.deviceFingerprint.generateFingerprint())
  3. Copia el fingerprint generado
  4. Ejecuta: node generate-licensed-device.mjs device
  5. Pega el fingerprint cuando se solicite
    `);
}

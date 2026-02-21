import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🔐 Configurando sistema de licencias DTE...\n');

// Verificar si ya existen las llaves
if (fs.existsSync('private-key.pem') && fs.existsSync('public-key.pem')) {
  console.log('⚠️ Las llaves ya existen. Si quieres regenerarlas, elimina los archivos private-key.pem y public-key.pem');
  process.exit(0);
}

try {
  // Generar llaves
  console.log('1. Generando par de llaves criptográficas...');
  execSync('node generate-license.mjs generate-keys', { stdio: 'inherit' });
  
  // Leer llave pública
  console.log('\n2. Leyendo llave pública...');
  const publicKeyJwk = JSON.parse(fs.readFileSync('public-key.jwk', 'utf8'));
  
  // Actualizar licenseValidator.ts con la llave pública
  console.log('\n3. Actualizando validador de licencias...');
  const licenseValidatorPath = path.join(__dirname, '..', 'utils', 'licenseValidator.ts');
  let licenseContent = fs.readFileSync(licenseValidatorPath, 'utf8');
  
  // Reemplazar placeholder con llave pública real
  licenseContent = licenseContent.replace(
    '"x": "TU_LLAVE_PUBLICA_X_AQUI"',
    `"x": "${publicKeyJwk.x}"`
  );
  licenseContent = licenseContent.replace(
    '"y": "TU_LLAVE_PUBLICA_Y_AQUI"',
    `"y": "${publicKeyJwk.y}"`
  );
  
  fs.writeFileSync(licenseValidatorPath, licenseContent);
  
  console.log('\n✅ Sistema de licencias configurado exitosamente!');
  console.log('\n📋 Próximos pasos:');
  console.log('1. Guarda securely el archivo private-key.pem (¡NUNCA COMPARTIR!)');
  console.log('2. Para generar licencias usa: node generate-license.mjs generate --email usuario@ejemplo.com');
  console.log('3. El archivo public-key.jwk contiene la llave pública para la app');
  
} catch (error) {
  console.error('❌ Error configurando el sistema:', error.message);
  process.exit(1);
}

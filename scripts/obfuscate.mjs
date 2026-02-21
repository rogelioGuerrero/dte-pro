import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

console.log('🔒 Ofuscando código de protección...');

// Instalar javascript-obfuscator si no está instalado
try {
  execSync('npm list javascript-obfuscator', { stdio: 'pipe' });
} catch {
  console.log('Instalando javascript-obfuscator...');
  execSync('npm install --save-dev javascript-obfuscator', { stdio: 'inherit' });
}

// Archivos a ofuscar (solo los críticos para la licencia)
const filesToObfuscate = [
  'utils/licenseValidator.ts',
  'utils/usageLimit.ts'
];

// Importar javascript-obfuscator
const JavaScriptObfuscator = require('javascript-obfuscator');

filesToObfuscate.forEach(file => {
  const filePath = path.join(__dirname, '..', file);
  const obfuscatedPath = filePath.replace('.ts', '.obfuscated.js');
  
  console.log(`\n📁 Procesando: ${file}`);
  
  // Leer archivo
  const source = fs.readFileSync(filePath, 'utf8');
  
  // Configuración de ofuscación (balanceada)
  const obfuscationResult = JavaScriptObfuscator.obfuscate(source, {
    compact: true,
    controlFlowFlattening: false, // Mantener legibilidad para debugging
    deadCodeInjection: false,
    debugProtection: false, // Puede causar problemas en producción
    debugProtectionInterval: false,
    disableConsoleOutput: false,
    identifierNamesGenerator: 'hexadecimal',
    log: false,
    numbersToExpressions: false,
    renameGlobals: false,
    rotateStringArray: true,
    selfDefending: true, // Protección contra debugging
    shuffleStringArray: true,
    simplify: true,
    splitStrings: true,
    splitStringsChunkLength: 10,
    stringArray: true,
    stringArrayEncoding: ['base64'],
    stringArrayThreshold: 0.75,
    transformObjectKeys: true,
    unicodeEscapeSequence: false
  });
  
  // Guardar versión ofuscada
  fs.writeFileSync(obfuscatedPath, obfuscationResult.getObfuscatedCode());
  
  console.log(`✅ Guardado: ${path.basename(obfuscatedPath)}`);
  console.log(`   Tamaño original: ${source.length} bytes`);
  console.log(`   Tamaño ofuscado: ${obfuscationResult.getObfuscatedCode().length} bytes`);
});

console.log('\n✨ Ofuscación completada!');
console.log('\n⚠️ Nota: Los archivos ofuscados son para referencia.');
console.log('   Para producción, considera un bundler con integración de ofuscación.');

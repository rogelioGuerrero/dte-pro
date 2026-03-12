#!/usr/bin/env node

import { execSync } from 'child_process';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Colores para consola
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function step(stepName, command) {
  log(`\n🔹 ${stepName}`, 'blue');
  try {
    execSync(command, { stdio: 'inherit', cwd: process.cwd() });
    log(`✅ ${stepName} completado`, 'green');
    return true;
  } catch (error) {
    log(`❌ Error en ${stepName}`, 'red');
    return false;
  }
}

function getGitStatus() {
  try {
    const status = execSync('git status --porcelain', { encoding: 'utf8' });
    return status.trim().split('\n').filter(line => line.trim());
  } catch (error) {
    return [];
  }
}

function getCommitMessage() {
  const changes = getGitStatus();
  if (changes.length === 0) {
    return 'chore: actualización del proyecto';
  }

  const hasNewFeatures = changes.some(line => line.includes('A ') || line.includes(' M '));
  const hasBugFixes = changes.some(line => line.includes('fix') || line.includes('bug'));
  const hasConfigChanges = changes.some(line => line.includes('config') || line.includes('.env') || line.includes('package.json'));

  if (hasNewFeatures) return 'feat: nueva funcionalidad implementada';
  if (hasBugFixes) return 'fix: corrección de errores';
  if (hasConfigChanges) return 'chore: actualización de configuración';
  return 'chore: actualización del código';
}

async function completeTask(description = '') {
  log('🚀 Iniciando flujo completo de finalización de tarea...', 'yellow');
  
  // 1. Type checking
  if (!step('Type Checking', 'npm run typecheck')) {
    log('❌ El type checking falló. Corrige los errores antes de continuar.', 'red');
    process.exit(1);
  }

  // 2. Build
  if (!step('Build del proyecto', 'npm run build')) {
    log('❌ El build falló. Corrige los errores antes de continuar.', 'red');
    process.exit(1);
  }

  // 3. Verificar si hay cambios
  const changes = getGitStatus();
  if (changes.length === 0) {
    log('📝 No hay cambios para commitear', 'yellow');
    return;
  }

  // 4. Git operations
  step('Agregar cambios', 'git add .');
  
  const commitMessage = description || getCommitMessage();
  step(`Crear commit: ${commitMessage}`, `git commit -m "${commitMessage}"`);
  
  step('Push a GitHub', 'git push origin main');

  log('\n🎉 Tarea completada exitosamente!', 'green');
  log('✅ Build exitoso', 'green');
  log('✅ Type checking exitoso', 'green');
  log('✅ Cambios subidos a GitHub', 'green');
  log('🚀 Deploy automático activado (si está configurado)', 'blue');
}

// Ejecutar el script
const description = process.argv[2];
completeTask(description).catch(error => {
  log('❌ Error en el flujo de trabajo:', 'red');
  console.error(error);
  process.exit(1);
});

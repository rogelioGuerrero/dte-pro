// Script para generar un certificado de prueba y un archivo .p12
// Uso: node scripts/generate-test-p12.mjs

import fs from 'fs';
import forge from 'node-forge';

const PASSWORD = process.env.TEST_P12_PASSWORD;

async function main() {
  if (!PASSWORD) {
    throw new Error('Falta definir TEST_P12_PASSWORD');
  }
  console.log('Generando certificado de prueba para DTE...');

  // Generar par de llaves RSA 2048
  const keys = forge.pki.rsa.generateKeyPair(2048);

  // Crear certificado autofirmado
  const cert = forge.pki.createCertificate();
  cert.publicKey = keys.publicKey;
  cert.serialNumber = (Math.floor(Math.random() * 1e16)).toString(16);

  const now = new Date();
  const oneYear = 365 * 24 * 60 * 60 * 1000;
  cert.validity.notBefore = new Date(now.getTime() - 5 * 60 * 1000); // 5 min atrás
  cert.validity.notAfter = new Date(now.getTime() + oneYear);

  const attrs = [
    { name: 'commonName', value: 'DTE Test Cert' },
    { name: 'organizationName', value: 'DTE Sandbox' },
    { name: 'countryName', value: 'SV' },
  ];

  cert.setSubject(attrs);
  cert.setIssuer(attrs);

  cert.setExtensions([
    { name: 'basicConstraints', cA: false },
    { name: 'keyUsage', keyCertSign: true, digitalSignature: true, nonRepudiation: true },
    { name: 'extKeyUsage', serverAuth: true, clientAuth: true },
  ]);

  // Firmar certificado
  cert.sign(keys.privateKey, forge.md.sha256.create());

  // Crear PKCS#12 (.p12)
  const p12Asn1 = forge.pkcs12.toPkcs12Asn1(
    keys.privateKey,
    cert,
    PASSWORD,
    { algorithm: '3des' }
  );

  const p12Der = forge.asn1.toDer(p12Asn1).getBytes();
  const p12Buffer = Buffer.from(p12Der, 'binary');

  const outPath = './test-dte.p12';
  fs.writeFileSync(outPath, p12Buffer);

  console.log('Archivo .p12 de prueba generado:');
  console.log(`  Ruta: ${outPath}`);
  console.log('  Contraseña: (definida en TEST_P12_PASSWORD)');
}

main().catch((err) => {
  console.error('Error generando .p12 de prueba:', err);
  process.exit(1);
});

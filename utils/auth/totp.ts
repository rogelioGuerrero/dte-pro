import { TOTP, Secret } from 'otpauth';

const STORAGE_KEY = 'dte_admin_totp_secret';
const APP_NAME = 'DTE Converter Pro';

// Generar un nuevo secreto aleatorio (base32)
export const generateSecret = (): string => {
  const secret = new Secret({ size: 20 });
  return secret.base32;
};

// Obtener la URI para el código QR
export const getTotpUri = (secret: string, issuer: string = APP_NAME): string => {
  const totp = new TOTP({
    issuer: issuer,
    label: 'Admin',
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
    secret: Secret.fromBase32(secret)
  });
  return totp.toString();
};

// Verificar un token
export const verifyToken = (token: string, secret: string): boolean => {
  if (!token || !secret) return false;
  
  const totp = new TOTP({
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
    secret: Secret.fromBase32(secret)
  });

  // delta returns null if validation fails, or the drift (integer) if successful
  const delta = totp.validate({ token, window: 1 });
  return delta !== null;
};

// Guardar secreto en localStorage
export const saveSecret = (secret: string): void => {
  localStorage.setItem(STORAGE_KEY, secret);
};

// Obtener secreto almacenado
export const getStoredSecret = (): string | null => {
  return localStorage.getItem(STORAGE_KEY);
};

// Verificar si hay configuración de 2FA
export const hasTotpConfigured = (): boolean => {
  return !!getStoredSecret();
};

// Eliminar configuración (reset)
export const clearTotpConfig = (): void => {
  localStorage.removeItem(STORAGE_KEY);
};

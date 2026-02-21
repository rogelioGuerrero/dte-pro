// Validaciones reutilizables para NIT, NRC, teléfono y correo

export interface ValidationResult {
  valid: boolean;
  message: string;
}

export const faltanDigitosMessage = (remaining: number): string => {
  if (remaining <= 0) return '';
  if (remaining === 1) return 'Falta 1 dígito';
  return `Faltan ${remaining} dígitos`;
};

export const validateNIT = (nit: string): ValidationResult => {
  if (!nit) return { valid: false, message: faltanDigitosMessage(9) };
  const nitClean = nit.replace(/[\s-]/g, '');
  if (!/^\d+$/.test(nitClean)) return { valid: false, message: 'Solo números' };
  if (nitClean.length === 14) return { valid: true, message: '' };
  if (nitClean.length === 9) return { valid: true, message: '' };
  if (nitClean.length > 14) return { valid: false, message: '9 ó 14 dígitos' };
  const target = nitClean.length > 9 ? 14 : 9;
  return { valid: false, message: faltanDigitosMessage(target - nitClean.length) };
};

export const validateNRC = (nrc: string): ValidationResult => {
  if (!nrc) return { valid: true, message: '' };
  const nrcClean = nrc.replace(/[\s-]/g, '');
  if (nrcClean.length === 0) return { valid: true, message: '' };
  if (!/^\d+$/.test(nrcClean)) return { valid: false, message: 'Solo números' };
  if (nrcClean.length < 6) return { valid: false, message: faltanDigitosMessage(6 - nrcClean.length) };
  if (nrcClean.length > 8) return { valid: false, message: '6-8 dígitos' };
  return { valid: true, message: '' };
};

export const validatePhone = (phone: string): ValidationResult => {
  if (!phone) return { valid: false, message: faltanDigitosMessage(8) };
  const phoneClean = phone.replace(/[\s-]/g, '');
  if (!/^\d+$/.test(phoneClean)) return { valid: false, message: 'Solo números' };
  if (phoneClean.length < 8) return { valid: false, message: faltanDigitosMessage(8 - phoneClean.length) };
  if (phoneClean.length > 8) return { valid: false, message: '8 dígitos' };
  return { valid: true, message: '' };
};

export const validateEmail = (email: string): ValidationResult => {
  if (!email) return { valid: false, message: 'Requerido' };
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email.trim())) return { valid: false, message: 'Formato inválido' };
  return { valid: true, message: '' };
};

export const formatEmailInput = (value: string): string => {
  return (value || '').replace(/\s+/g, '').trim();
};

export const formatTextInput = (value: string): string => {
  // Only normalize multiple spaces to single space, preserve single spaces
  return (value || '').replace(/\s{2,}/g, ' ');
};

export const formatMultilineTextInput = (value: string): string => {
  const normalized = (value || '').replace(/\r\n/g, '\n');
  const lines = normalized.split('\n').map((line) => line.replace(/[ \t]+/g, ' '));
  return lines.join('\n');
};

export const normalizeIdDigits = (value: string): string => {
  return (value || '').replace(/\D/g, '');
};

export const formatNitOrDuiInput = (value: string): string => {
  const digits = normalizeIdDigits(value).slice(0, 14);

  if (digits.length <= 8) return digits;
  if (digits.length === 9) return `${digits.slice(0, 8)}-${digits.slice(8)}`;

  const part1 = digits.slice(0, 4);
  const part2 = digits.slice(4, 10);
  const part3 = digits.slice(10, 13);
  const part4 = digits.slice(13, 14);
  let formatted = part1;
  if (part2) formatted += `-${part2}`;
  if (part3) formatted += `-${part3}`;
  if (part4) formatted += `-${part4}`;
  return formatted;
};

export const formatNRCInput = (value: string): string => {
  const digits = normalizeIdDigits(value).slice(0, 8);
  if (digits.length <= 6) return digits;
  return `${digits.slice(0, digits.length - 1)}-${digits.slice(-1)}`;
};

export const getNitOrDuiDigitsRemaining = (value: string): number => {
  const digits = normalizeIdDigits(value);
  const target = digits.length > 9 ? 14 : 9;
  return Math.max(0, target - digits.length);
};

export const formatPhoneInput = (value: string): string => {
  const digits = normalizeIdDigits(value).slice(0, 8);
  if (digits.length <= 4) return digits;
  return `${digits.slice(0, 4)}-${digits.slice(4)}`;
};

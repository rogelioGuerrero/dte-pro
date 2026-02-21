// Catálogo de Formas de Pago y Condiciones
// Basado en especificación oficial del Ministerio de Hacienda

import { CatalogoItem } from './documentos';

// CAT-017: Forma de Pago
export const formasPago: CatalogoItem[] = [
  { codigo: '01', descripcion: 'Efectivo' },
  { codigo: '02', descripcion: 'Cheque' },
  { codigo: '03', descripcion: 'Tarjeta de Crédito' },
  { codigo: '04', descripcion: 'Tarjeta de Débito' },
  { codigo: '05', descripcion: 'Transferencia Electrónica' },
  { codigo: '06', descripcion: 'Depósito Bancario' },
  { codigo: '07', descripcion: 'Letra de Cambio' },
  { codigo: '08', descripcion: 'Pagaré' },
  { codigo: '09', descripcion: 'Cupones' },
  { codigo: '10', descripcion: 'Nota de Crédito' },
  { codigo: '11', descripcion: 'Criptomonedas' },
  { codigo: '12', descripcion: 'Pago Móvil' },
  { codigo: '13', descripcion: 'Pago con Saldo a Favor' },
  { codigo: '99', descripcion: 'Otros' },
];

// Formas de pago que requieren procesamiento Stripe
export const formasPagoStripe = ['03', '04']; // Tarjeta de Crédito y Débito

// Verificar si una forma de pago requiere Stripe
export const requiereStripe = (formaPago: string): boolean => {
  return formasPagoStripe.includes(formaPago);
};

// CAT-018: Plazo
export const plazos: CatalogoItem[] = [
  { codigo: '01', descripcion: 'Días' },
  { codigo: '02', descripcion: 'Meses' },
  { codigo: '03', descripcion: 'Años' },
];

// Tipos de descuento
export const tiposDescuento: CatalogoItem[] = [
  { codigo: 'PORCENTAJE', descripcion: 'Descuento por porcentaje' },
  { codigo: 'MONTO', descripcion: 'Descuento por monto fijo' },
];

// Monedas
export const monedas: CatalogoItem[] = [
  { codigo: 'USD', descripcion: 'Dólar estadounidense' },
];

// Obtener forma de pago por código
export const getFormaPagoPorCodigo = (codigo: string): CatalogoItem | undefined => {
  return formasPago.find(f => f.codigo === codigo);
};

// Obtener plazo por código
export const getPlazoPorCodigo = (codigo: string): CatalogoItem | undefined => {
  return plazos.find(p => p.codigo === codigo);
};

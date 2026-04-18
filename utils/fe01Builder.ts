import { numeroALetras, redondear } from './formatters';
import type { EmisorData } from './emisorDb';
import type { DTEJSON, ItemFactura } from './types';

export interface Fe01ItemInput {
  cantidad: number;
  descripcion: string;
  precioUnitario: number;
  descuento?: number;
}

export interface Fe01EmisorInput {
  nit: string;
  nrc: string;
  nombre: string;
  codActividad: string;
  descActividad: string;
  tipoEstablecimiento: string;
  departamento: string;
  municipio: string;
  direccion: string;
  telefono: string;
  correo: string;
  codEstableMH: string;
  codPuntoVentaMH: string;
  nombreComercial?: string | null;
}

export interface Fe01BuildInput {
  ambiente: '00' | '01';
  businessId?: string | null;
  receptorEmail?: string | null;
  emisor:
    | Fe01EmisorInput
    | Pick<
        EmisorData,
        | 'nit'
        | 'nrc'
        | 'nombre'
        | 'actividadEconomica'
        | 'descActividad'
        | 'tipoEstablecimiento'
        | 'departamento'
        | 'municipio'
        | 'direccion'
        | 'telefono'
        | 'correo'
        | 'codEstableMH'
        | 'codPuntoVentaMH'
        | 'nombreComercial'
      >;
  items: Fe01ItemInput[];
  fecha?: Date;
}

export interface Fe01EmissionRequest {
  dte: DTEJSON;
  ambiente: '00' | '01';
  flowType: 'emission';
  businessId: string | null;
  receptorEmail: string | null;
}

const IVA_RATE = 0.13;

const sanitizeText = (value?: string | null): string => (value || '').trim();

const sanitizeOrNull = (value?: string | null): string | null => {
  const text = sanitizeText(value);
  return text ? text : null;
};

const sanitizeDigits = (value?: string | null): string => sanitizeText(value).replace(/\D/g, '');

const sanitizeCommercialName = (value?: string | null): string | null => {
  const text = sanitizeText(value);
  if (!text) {
    return null;
  }

  const lowered = text.toLowerCase();
  if (['n/a', 'na', 'none', 'null', 'sin nombre'].includes(lowered)) {
    return null;
  }

  return text;
};

const generateUuidV4Upper = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID().toUpperCase();
  }

  const fallback = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });

  return fallback.toUpperCase();
};

const generateNumeroControl = (codEstableMH: string, codPuntoVentaMH: string): string => {
  const estable = sanitizeDigits(codEstableMH).padStart(4, '0').slice(-4);
  const punto = sanitizeDigits(codPuntoVentaMH).padStart(4, '0').slice(-4);
  const sequence = Math.floor(Math.random() * 1_000_000_000_000_000)
    .toString()
    .padStart(15, '0')
    .slice(-15);

  return `DTE-01-${estable}${punto}-${sequence}`;
};

const formatDate = (date: Date): string => date.toISOString().slice(0, 10);
const formatTime = (date: Date): string => date.toTimeString().slice(0, 8);

const resolveEmisor = (emisor: Fe01BuildInput['emisor']): Fe01EmisorInput => ({
  nit: sanitizeText(emisor.nit),
  nrc: sanitizeText(emisor.nrc),
  nombre: sanitizeText(emisor.nombre),
  codActividad: sanitizeText('codActividad' in emisor ? emisor.codActividad : emisor.actividadEconomica) || '00000',
  descActividad: sanitizeText(emisor.descActividad),
  tipoEstablecimiento: sanitizeText(emisor.tipoEstablecimiento) || '01',
  departamento: sanitizeText(emisor.departamento) || '01',
  municipio: sanitizeText(emisor.municipio) || '01',
  direccion: sanitizeText(emisor.direccion),
  telefono: sanitizeText(emisor.telefono),
  correo: sanitizeText(emisor.correo),
  codEstableMH: sanitizeText(emisor.codEstableMH) || 'M001',
  codPuntoVentaMH: sanitizeText(emisor.codPuntoVentaMH) || 'P001',
  nombreComercial: sanitizeCommercialName('nombreComercial' in emisor ? emisor.nombreComercial : null),
});

const buildLine = (item: Fe01ItemInput, index: number): ItemFactura => {
  const cantidad = redondear(Number(item.cantidad) || 0, 8);
  const precioUniConIva = redondear(Number(item.precioUnitario) || 0, 8);
  const montoDescuConIva = redondear(Number(item.descuento) || 0, 8);

  const precioUniBase = redondear(precioUniConIva > 0 ? precioUniConIva / (1 + IVA_RATE) : 0, 8);
  const montoDescuBase = redondear(montoDescuConIva > 0 ? montoDescuConIva / (1 + IVA_RATE) : 0, 8);
  const ventaGravada = redondear((cantidad * precioUniBase) - montoDescuBase, 8);
  const ivaItem = redondear(ventaGravada > 0 ? ventaGravada * IVA_RATE : 0, 2);

  return {
    numItem: index + 1,
    tipoItem: 2,
    cantidad,
    codigo: null,
    uniMedida: 59,
    descripcion: sanitizeText(item.descripcion),
    precioUni: precioUniBase,
    montoDescu: montoDescuBase,
    ventaNoSuj: 0,
    ventaExenta: 0,
    ventaGravada: ventaGravada,
    tributos: null, 
    numeroDocumento: null,
    codTributo: null,
    psv: 0,
    noGravado: 0,
    ivaItem,
  };
};

export const buildFe01EmissionRequest = (input: Fe01BuildInput): Fe01EmissionRequest => {
  if (!input.items.length) {
    throw new Error('DTE01 requires at least one item');
  }

  const emisor = resolveEmisor(input.emisor);
  const now = input.fecha || new Date();
  const cuerpoDocumento = input.items.map(buildLine);
  const totalNoSuj = 0;
  const totalExenta = 0;
  
  const totalGravada = redondear(cuerpoDocumento.reduce((sum, item) => sum + (item.ventaGravada || 0), 0), 2);
  const totalNoGravado = redondear(cuerpoDocumento.reduce((sum, item) => sum + (item.noGravado || 0), 0), 2);
  const subTotalVentas = redondear(totalGravada + totalExenta + totalNoSuj, 2);
  
  const totalDescu = redondear(cuerpoDocumento.reduce((sum, item) => sum + (item.montoDescu || 0), 0), 2);
  const descuGravada = totalDescu;
  
  const subTotal = subTotalVentas;
  const totalIva = redondear(cuerpoDocumento.reduce((sum, item) => sum + (item.ivaItem || 0), 0), 2);
  const ivaRete1 = 0;
  const reteRenta = 0;
  const saldoFavor = 0;

  const montoTotalOperacion = redondear(
    subTotal + totalIva + totalNoGravado - ivaRete1 - reteRenta + saldoFavor,
    2
  );
  const totalPagar = montoTotalOperacion;

  const dte: DTEJSON = {
    identificacion: {
      version: 1,
      ambiente: input.ambiente,
      tipoDte: '01',
      numeroControl: generateNumeroControl(emisor.codEstableMH, emisor.codPuntoVentaMH),
      codigoGeneracion: generateUuidV4Upper(),
      tipoModelo: 1,
      tipoOperacion: 1,
      tipoContingencia: null,
      motivoContin: null,
      fecEmi: formatDate(now),
      horEmi: formatTime(now),
      tipoMoneda: 'USD',
    },
    documentoRelacionado: null,
    emisor: {
      nit: emisor.nit,
      nrc: emisor.nrc,
      nombre: emisor.nombre,
      codActividad: emisor.codActividad,
      descActividad: emisor.descActividad,
      nombreComercial: (emisor.nombreComercial && emisor.nombreComercial.length >= 5 && emisor.nombreComercial !== 'n/a') ? emisor.nombreComercial : emisor.nombre,
      tipoEstablecimiento: emisor.tipoEstablecimiento,
      codEstable: emisor.codEstableMH || '0001',
      codPuntoVenta: emisor.codPuntoVentaMH || '0001',
      direccion: {
        departamento: emisor.departamento,
        municipio: emisor.municipio,
        complemento: emisor.direccion,
      },
      telefono: emisor.telefono,
      correo: emisor.correo,
      codEstableMH: emisor.codEstableMH,
      codPuntoVentaMH: emisor.codPuntoVentaMH,
    },
    receptor: {
      tipoDocumento: totalPagar >= 1095 ? '13' : null,
      numDocumento: totalPagar >= 1095 ? '12345678-9' : null,
      nrc: null,
      nombre: 'Consumidor Final',
      codActividad: null,
      descActividad: null,
      direccion: {
        departamento: emisor.departamento,
        municipio: emisor.municipio,
        complemento: 'Consumidor final',
      },
      telefono: null,
      correo: sanitizeOrNull(input.receptorEmail),
    },
    otrosDocumentos: null,
    ventaTercero: null,
    cuerpoDocumento,
    resumen: {
      totalNoSuj,
      totalExenta,
      totalGravada,
      subTotalVentas,
      descuNoSuj: 0,
      descuExenta: 0,
      descuGravada,
      porcentajeDescuento: 0,
      totalDescu,
      tributos: null,
      subTotal,
      ivaRete1,
      reteRenta,
      montoTotalOperacion,
      totalNoGravado,
      totalPagar,
      totalLetras: numeroALetras(totalPagar),
      totalIva,
      saldoFavor,
      condicionOperacion: 1,
      pagos: [
        {
          codigo: '01',
          montoPago: totalPagar,
          referencia: null,
          plazo: null,
          periodo: null,
        },
      ],
      numPagoElectronico: null,
    },
    extension: null,
    apendice: null,
  };

  return {
    dte,
    ambiente: input.ambiente,
    flowType: 'emission',
    businessId: input.businessId ?? null,
    receptorEmail: sanitizeOrNull(input.receptorEmail),
  };
};

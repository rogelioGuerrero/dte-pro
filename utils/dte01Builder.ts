import { redondear, numeroALetras } from './formatters';
import type { EmisorData } from './emisorDb';

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
  emisor: Fe01EmisorInput | Pick<EmisorData, 'nit' | 'nrc' | 'nombre' | 'actividadEconomica' | 'descActividad' | 'tipoEstablecimiento' | 'departamento' | 'municipio' | 'direccion' | 'telefono' | 'correo' | 'codEstableMH' | 'codPuntoVentaMH' | 'nombreComercial'>;
  items: Fe01ItemInput[];
  fecha?: Date;
}

export interface Fe01EmissionRequest {
  dte: Fe01Dte;
  ambiente: '00' | '01';
  flowType: 'emission';
  businessId: string | null;
  receptorEmail: string | null;
}

export interface Fe01Dte {
  identificacion: {
    version: 1;
    ambiente: '00' | '01';
    tipoDte: '01';
    numeroControl: string;
    codigoGeneracion: string;
    tipoModelo: 1;
    tipoOperacion: 1;
    tipoContingencia: null;
    motivoContin: null;
    fecEmi: string;
    horEmi: string;
    tipoMoneda: 'USD';
  };
  documentoRelacionado: null;
  emisor: {
    nit: string;
    nrc: string;
    nombre: string;
    codActividad: string;
    descActividad: string;
    nombreComercial: string | null;
    tipoEstablecimiento: string;
    direccion: {
      departamento: string;
      municipio: string;
      complemento: string;
    };
    telefono: string;
    correo: string;
    codEstableMH: string;
    codPuntoVentaMH: string;
  };
  receptor: {
    tipoDocumento: null;
    numDocumento: null;
    nrc: null;
    nombre: 'Consumidor Final';
    nombreComercial: null;
    codActividad: null;
    descActividad: null;
    direccion: {
      departamento: string;
      municipio: string;
      complemento: string;
    };
    telefono: null;
    correo: string | null;
  };
  otrosDocumentos: null;
  ventaTercero: null;
  cuerpoDocumento: Array<{
    numItem: number;
    tipoItem: 2;
    cantidad: number;
    codigo: null;
    uniMedida: 59;
    descripcion: string;
    precioUni: number;
    montoDescu: number;
    ventaNoSuj: 0;
    ventaExenta: 0;
    ventaGravada: number;
    tributos: string[] | null;
    numeroDocumento: null;
    codTributo: null;
    psv: 0;
    noGravado: 0;
  }>;
  resumen: {
    totalNoSuj: 0;
    totalExenta: 0;
    totalGravada: number;
    subTotalVentas: number;
    descuNoSuj: 0;
    descuExenta: 0;
    descuGravada: number;
    porcentajeDescuento: 0;
    totalDescu: number;
    totalIva: number;
    tributos: Array<{
      codigo: string;
      descripcion: string;
      valor: number;
    }> | null;
    subTotal: number;
    ivaRete1: 0;
    reteRenta: 0;
    montoTotalOperacion: number;
    totalNoGravado: 0;
    totalPagar: number;
    totalLetras: string;
    saldoFavor: 0;
    condicionOperacion: 1;
    pagos: Array<{
      codigo: '01';
      montoPago: number;
      referencia: null;
      plazo: null;
      periodo: null;
    }>;
    ivaPerci1: 0;
    numPagoElectronico: null;
  };
  extension: {
    nombEntrega: null;
    docuEntrega: null;
    nombRecibe: null;
    docuRecibe: null;
    observaciones: null;
    placaVehiculo: null;
  };
  apendice: null;
}

const onlyDigits = (value: string): string => (value || '').replace(/\D/g, '');

const normalizedText = (value?: string | null): string => (value || '').trim();

const normalizedOrNull = (value?: string | null): string | null => {
  const text = normalizedText(value);
  return text ? text : null;
};

const normalizedCommercialName = (value?: string | null): string | null => {
  const text = normalizedText(value);
  if (!text) {
    return null;
  }

  const lowered = text.toLowerCase();
  if (lowered === 'n/a' || lowered === 'na' || lowered === 'none' || lowered === 'null' || lowered === 'sin nombre') {
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

const generateControlSequence = (): string => {
  const randomPart = Math.floor(Math.random() * 1_000_000_000_000_000)
    .toString()
    .padStart(15, '0')
    .slice(-15);
  return randomPart;
};

const generateNumeroControl = (codEstableMH: string, codPuntoVentaMH: string): string => {
  const estable = onlyDigits(codEstableMH).padStart(4, '0').slice(-4);
  const punto = onlyDigits(codPuntoVentaMH).padStart(4, '0').slice(-4);
  return `DTE-01-${estable}${punto}-${generateControlSequence()}`;
};

const formatDate = (date: Date): string => date.toISOString().slice(0, 10);

const formatTime = (date: Date): string => date.toTimeString().slice(0, 8);

const resolveEmisor = (emisor: Fe01BuildInput['emisor']): Fe01EmisorInput => {
  const fallbackActividad = '00000';
  return {
    nit: normalizedText(emisor.nit),
    nrc: normalizedText(emisor.nrc),
    nombre: normalizedText(emisor.nombre),
    codActividad: normalizedText('codActividad' in emisor ? emisor.codActividad : emisor.actividadEconomica) || fallbackActividad,
    descActividad: normalizedText(emisor.descActividad),
    tipoEstablecimiento: normalizedText(emisor.tipoEstablecimiento) || '01',
    departamento: normalizedText(emisor.departamento) || '01',
    municipio: normalizedText(emisor.municipio) || '01',
    direccion: normalizedText(emisor.direccion),
    telefono: normalizedText(emisor.telefono),
    correo: normalizedText(emisor.correo),
    codEstableMH: normalizedText(emisor.codEstableMH) || 'M001',
    codPuntoVentaMH: normalizedText(emisor.codPuntoVentaMH) || 'P001',
    nombreComercial: normalizedCommercialName('nombreComercial' in emisor ? emisor.nombreComercial : null),
  };
};

export const buildFe01EmissionRequest = (input: Fe01BuildInput): Fe01EmissionRequest => {
  if (!input.items.length) {
    throw new Error('Agrega al menos un item para facturar consumidora final 01.');
  }

  const emisor = resolveEmisor(input.emisor);
  const now = input.fecha ?? new Date();

  const cuerpoDocumento = input.items.map((item, index) => {
    const cantidad = redondear(Number(item.cantidad) || 0, 8);
    const precioUni = redondear(Number(item.precioUnitario) || 0, 8);
    const montoDescu = redondear(Number(item.descuento) || 0, 8);
    const totalLinea = redondear((cantidad * precioUni) - montoDescu, 8);

    return {
      numItem: index + 1,
      tipoItem: 2 as const,
      cantidad,
      codigo: null,
      uniMedida: 59 as const,
      descripcion: normalizedText(item.descripcion),
      precioUni,
      montoDescu,
      ventaNoSuj: 0 as const,
      ventaExenta: 0 as const,
      ventaGravada: totalLinea,
      tributos: ['20'],
      numeroDocumento: null,
      codTributo: null,
      psv: 0 as const,
      noGravado: 0 as const,
    };
  });

  const totalGravada = redondear(cuerpoDocumento.reduce((sum, item) => sum + item.ventaGravada, 0), 2);
  const subTotalVentas = totalGravada;
  const totalDescu = redondear(cuerpoDocumento.reduce((sum, item) => sum + item.montoDescu, 0), 2);
  const descuGravada = totalDescu;
  const totalIva = redondear(totalGravada * 0.13, 2);
  const subTotal = totalGravada;
  const montoTotalOperacion = totalGravada;
  const totalPagar = totalGravada;

  const dte: Fe01Dte = {
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
      nombreComercial: normalizedOrNull(emisor.nombreComercial) ?? null,
      tipoEstablecimiento: emisor.tipoEstablecimiento,
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
      tipoDocumento: null,
      numDocumento: null,
      nrc: null,
      nombre: 'Consumidor Final',
      nombreComercial: null,
      codActividad: null,
      descActividad: null,
      direccion: {
        departamento: emisor.departamento,
        municipio: emisor.municipio,
        complemento: 'Consumidor final',
      },
      telefono: null,
      correo: normalizedOrNull(input.receptorEmail) ?? null,
    },
    otrosDocumentos: null,
    ventaTercero: null,
    cuerpoDocumento,
    resumen: {
      totalNoSuj: 0,
      totalExenta: 0,
      totalGravada,
      subTotalVentas,
      descuNoSuj: 0,
      descuExenta: 0,
      descuGravada,
      porcentajeDescuento: 0,
      totalDescu,
      totalIva,
      tributos: totalIva > 0
        ? [{ codigo: '20', descripcion: 'IVA 13%', valor: totalIva }]
        : null,
      subTotal,
      ivaRete1: 0,
      reteRenta: 0,
      montoTotalOperacion,
      totalNoGravado: 0,
      totalPagar,
      totalLetras: numeroALetras(totalPagar),
      saldoFavor: 0,
      condicionOperacion: 1,
      pagos: [{
        codigo: '01',
        montoPago: totalPagar,
        referencia: null,
        plazo: null,
        periodo: null,
      }],
      ivaPerci1: 0,
      numPagoElectronico: null,
    },
    extension: {
      nombEntrega: null,
      docuEntrega: null,
      nombRecibe: null,
      docuRecibe: null,
      observaciones: null,
      placaVehiculo: null,
    },
    apendice: null,
  };

  return {
    dte,
    ambiente: input.ambiente,
    flowType: 'emission',
    businessId: input.businessId ?? null,
    receptorEmail: normalizedOrNull(input.receptorEmail) ?? null,
  };
};

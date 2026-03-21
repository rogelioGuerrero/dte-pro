import { DatosFactura, DTEJSON } from './types';
import {
  obtenerFechaActual,
  obtenerHoraActual,
  generarNumeroControl,
  generarUUID,
  numeroALetras,
  redondear,
} from './formatters';
import {
  isCodActividad,
  isCodDepartamento,
  isCodMunicipio,
  normalizeEmisorCodActividad,
} from './validators';
import { calcularTotales } from './totales';

const DTE_VERSION_BY_TYPE: Record<string, number> = {
  '01': 1,
  '03': 3,
  '11': 1,
  '14': 1,
};

export const getVersionByTipoDte = (tipoDte?: string | null): number => {
  const normalizedTipoDte = (tipoDte || '').trim();
  return DTE_VERSION_BY_TYPE[normalizedTipoDte] ?? 1;
};

const normalizePhone = (value?: string | null): string | null => {
  const digits = (value || '').replace(/\D/g, '').trim();
  return digits || null;
};

const normalizeOptionalText = (value?: string | null): string | null => {
  const normalized = (value || '').trim();
  if (!normalized) return null;
  if (['n/a', 'na', 'none', 'null', '-'].includes(normalized.toLowerCase())) return null;
  return normalized;
};

const normalizeRequiredText = (value?: string | null, fallback: string = ''): string => {
  const normalized = (value || '').trim();
  return normalized || fallback;
};

const normalizeUbicacionCode = (value?: string | number | null): string => {
  if (value === null || value === undefined) return '';
  return String(value).trim();
};

const normalizeDepartamentoOrFallback = (value?: string | number | null): string => {
  const normalized = normalizeUbicacionCode(value);
  return isCodDepartamento(normalized) ? normalized : '01';
};

const normalizeMunicipioOrFallback = (value?: string | number | null): string => {
  const normalized = normalizeUbicacionCode(value);
  return isCodMunicipio(normalized) ? normalized : '01';
};

// Generar estructura JSON del DTE
export const generarDTE = (datos: DatosFactura, correlativo: number, ambiente: string = '00'): DTEJSON => {
  const uuid = generarUUID();
  const numeroControl = generarNumeroControl(datos.tipoDocumento, correlativo, datos.emisor.codEstableMH, datos.emisor.codPuntoVentaMH);
  const version = getVersionByTipoDte(datos.tipoDocumento);

  // 1. Generar Cuerpo del Documento con redondeo a 8 decimales (Regla de la novena posición)
  const cuerpoDocumento = datos.items.map((item, index) => {
    const cantidad = redondear(item.cantidad, 8);

    // Tomar base e IVA ya calculados en la UI para FE (01); no recalcular dividiendo entre 1.13
    const ventaGravada = redondear(item.ventaGravada, 8);
    const montoDescu = redondear(item.montoDescu, 8);
    const ventaNoSuj = redondear(item.ventaNoSuj, 8);
    const ventaExenta = redondear(item.ventaExenta, 8);
    const baseImponibleItem = redondear(ventaGravada + ventaExenta + ventaNoSuj, 8);
    const precioUni = datos.tipoDocumento === '03' && cantidad > 0
      ? redondear(baseImponibleItem / cantidad, 8)
      : redondear(item.precioUni, 8);

    // FE (01) no debe enviar tributos desde el frontend; el backend los arma
    const tributos = datos.tipoDocumento === '01'
      ? null
      : (datos.tipoDocumento === '03'
        ? ['20']
        : (ventaGravada > 0 ? item.tributos : null));

    return {
      numItem: index + 1,
      tipoItem: item.tipoItem,
      cantidad,
      codigo: item.codigo ?? null,
      uniMedida: item.uniMedida ?? 99,
      descripcion: item.descripcion,
      precioUni,
      montoDescu,
      ventaNoSuj,
      ventaExenta,
      ventaGravada,
      tributos,
      numeroDocumento: item.numeroDocumento ?? null,
      codTributo: null,
      psv: item.psv ? redondear(item.psv, 2) : 0,
      noGravado: item.noGravado ? redondear(item.noGravado, 2) : 0,
      ...(datos.tipoDocumento === '03' ? {} : { ivaItem: redondear(item.ivaItem || 0, 2) }),
    };
  });

  // 2. Calcular Totales del Resumen basados en el Cuerpo ya procesado (Bases Imponibles)
  const {
    totalNoSuj,
    totalExenta,
    totalGravada,
    totalNoGravado,
    subTotalVentas,
    subTotal,
    totalDescu,
    iva: totalIva,
    montoTotalOperacion,
    totalPagar,
  } = calcularTotales(cuerpoDocumento, datos.tipoDocumento);

  // Consolidar tributos: solo IVA 13% (código 20) por ahora, y solo para FE/CCF
  const aplicaIVAResumen = datos.tipoDocumento === '01' || datos.tipoDocumento === '03';

  const tributosResumen = datos.tipoDocumento === '03'
    ? (totalIva > 0 ? [{ codigo: '20', descripcion: 'IVA 13%', valor: totalIva }] : null)
    : (datos.tipoDocumento === '01'
      ? null
      : (aplicaIVAResumen && totalGravada > 0 && totalIva > 0
        ? [{ codigo: '20', descripcion: 'IVA 13%', valor: totalIva }]
        : null));

  const receptorIdDigits = (datos.receptor.nit || '').replace(/[\s-]/g, '').trim();
  const receptorSinDocumento = receptorIdDigits.length === 0;
  const isCreditoFiscal = datos.tipoDocumento === '03';

  const receptorCodActividad = isCodActividad(datos.receptor.actividadEconomica)
    ? datos.receptor.actividadEconomica.trim()
    : null;

  const receptorDescActividad = datos.receptor.descActividad?.trim()
    ? datos.receptor.descActividad.trim()
    : (!isCodActividad(datos.receptor.actividadEconomica) && (datos.receptor.actividadEconomica || '').trim()
        ? (datos.receptor.actividadEconomica || '').trim()
        : null);

  const receptorDireccion =
    isCodDepartamento(datos.receptor.departamento) && isCodMunicipio(datos.receptor.municipio)
      ? {
          departamento: datos.receptor.departamento.trim(),
          municipio: datos.receptor.municipio.trim(),
          complemento: datos.receptor.direccion || '',
        }
      : null;

  const emisorCodActividad = normalizeEmisorCodActividad(datos.emisor.actividadEconomica);
  const emisorDescActividad = (datos.emisor.descActividad || '').trim();
  
  const emisorNit = (datos.emisor.nit || '').replace(/[\s-]/g, '').trim();
  const emisorNrc = (datos.emisor.nrc || '').replace(/[\s-]/g, '').trim();
  const receptorNrc = (datos.receptor.nrc || '').replace(/[\s-]/g, '').trim();
  const emisorNombre = normalizeRequiredText(datos.emisor.nombre);
  const emisorNombreComercial = normalizeOptionalText(datos.emisor.nombreComercial);
  const emisorDireccionComplemento = normalizeRequiredText(datos.emisor.direccion, 'Dirección del negocio');
  const emisorTelefono = normalizeRequiredText(normalizePhone(datos.emisor.telefono), '00000000');
  const emisorCorreo = normalizeRequiredText(datos.emisor.correo);
  const emisorCodEstableMH = (datos.emisor.codEstableMH || 'M001').trim();
  const emisorCodPuntoVentaMH = (datos.emisor.codPuntoVentaMH || 'P001').trim();
  const receptorNombre = normalizeRequiredText(datos.receptor.name, 'Consumidor Final');
  const receptorTelefono = normalizePhone(datos.receptor.telefono);
  const receptorCorreo = normalizeOptionalText(datos.receptor.email);
  const receptorNit = receptorIdDigits.length === 14 ? receptorIdDigits : '';
  const receptorDui = receptorIdDigits.length === 9 ? receptorIdDigits : '';
  const receptorDireccionFinal = isCreditoFiscal
    ? {
        departamento: normalizeDepartamentoOrFallback(datos.receptor.departamento),
        municipio: normalizeMunicipioOrFallback(datos.receptor.municipio),
        complemento: normalizeRequiredText(datos.receptor.direccion, 'Dirección del receptor'),
      }
    : receptorDireccion;

  const receptorBase = {
    ...(isCreditoFiscal && receptorNit ? { nit: receptorNit } : {}),
    nrc: receptorNrc || null,
    nombre: receptorNombre,
    codActividad: isCreditoFiscal ? (receptorCodActividad || '00000') : receptorCodActividad,
    descActividad: isCreditoFiscal
      ? (receptorDescActividad || normalizeRequiredText(datos.receptor.descActividad || datos.receptor.actividadEconomica, 'GIRO NO ESPECIFICADO'))
      : receptorDescActividad,
    direccion: receptorDireccionFinal,
    telefono: receptorTelefono,
    ...(receptorCorreo !== null ? { correo: receptorCorreo } : {}),
  } as DTEJSON['receptor'];

  const receptorDocumentoCampos = isCreditoFiscal
    ? {}
    : {
        tipoDocumento: receptorSinDocumento ? null : (receptorDui ? '13' : '36'),
        numDocumento: receptorSinDocumento ? null : receptorIdDigits,
      };

  const dteJSON: DTEJSON = {
    identificacion: {
      version,
      ambiente,
      tipoDte: datos.tipoDocumento,
      numeroControl,
      codigoGeneracion: uuid,
      tipoModelo: 1,
      tipoOperacion: datos.tipoTransmision,
      tipoContingencia: null,
      motivoContin: null,
      fecEmi: obtenerFechaActual(),
      horEmi: obtenerHoraActual(),
      tipoMoneda: 'USD',
    },
    documentoRelacionado: null,
    emisor: {
      nit: emisorNit,
      nrc: emisorNrc,
      nombre: emisorNombre,
      codActividad: emisorCodActividad,
      descActividad: emisorDescActividad,
      nombreComercial: emisorNombreComercial,
      tipoEstablecimiento: datos.emisor.tipoEstablecimiento || '01',
      codEstable: null,
      codPuntoVenta: null,
      direccion: {
        departamento: normalizeDepartamentoOrFallback(datos.emisor.departamento),
        municipio: normalizeMunicipioOrFallback(datos.emisor.municipio),
        complemento: emisorDireccionComplemento,
      },
      telefono: emisorTelefono,
      correo: emisorCorreo,
      codEstableMH: emisorCodEstableMH,
      codPuntoVentaMH: emisorCodPuntoVentaMH,
    },
    receptor: {
      ...receptorBase,
      ...receptorDocumentoCampos,
    },
    otrosDocumentos: null,
    ventaTercero: null,
    cuerpoDocumento,
    resumen: {
      totalNoSuj: totalNoSuj,
      totalExenta: totalExenta,
      totalGravada: totalGravada,
      subTotalVentas: subTotalVentas,
      descuNoSuj: 0,
      descuExenta: 0,
      descuGravada: totalDescu,
      porcentajeDescuento: 0,
      totalDescu: totalDescu,
      totalIva: totalIva,
      tributos: tributosResumen,
      subTotal: subTotal,
      ivaRete1: 0,
      reteRenta: 0,
      montoTotalOperacion: montoTotalOperacion,
      totalNoGravado,
      totalPagar: totalPagar,
      totalLetras: numeroALetras(totalPagar),
      saldoFavor: 0,
      condicionOperacion: datos.condicionOperacion,
      pagos: datos.condicionOperacion === 1 ? [{
        codigo: String(datos.formaPago).padStart(2, '0'),
        montoPago: totalPagar,
        referencia: null,
        plazo: null,
        periodo: null,
      }] : null,
      numPagoElectronico: null,
    },
    extension: {
      nombEntrega: null,
      docuEntrega: null,
      nombRecibe: null,
      docuRecibe: null,
      observaciones: normalizeOptionalText(datos.observaciones) ?? null,
      placaVehiculo: null,
    },
    apendice: null,
  };
  
  return dteJSON;
};

// Convertir DTE a Contingencia (Modelo Diferido)
export const convertirAContingencia = (dte: DTEJSON, motivo: string = 'Falla en el servicio de Internet'): DTEJSON => {
  const cloned = JSON.parse(JSON.stringify(dte));
  
  cloned.identificacion.tipoModelo = 2; // Modelo Diferido
  cloned.identificacion.tipoOperacion = 2; // Transmisión por Contingencia
  cloned.identificacion.tipoContingencia = 2; // 2 = Falla en el servicio de Internet (por defecto)
  cloned.identificacion.motivoContin = motivo;
  
  // Actualizar fecha y hora a la actual (momento de la firma offline)
  cloned.identificacion.fecEmi = obtenerFechaActual();
  cloned.identificacion.horEmi = obtenerHoraActual();
  
  return cloned;
};

// Re-exportar utilidades y catálogos para mantener API pública
export type { ItemFactura, DatosFactura, DTEJSON } from './types';
export { calcularTotales } from './totales';
export {
  generarCorrelativoControlado,
  generarUUID,
  generarNumeroControl,
  redondear,
  numeroALetras,
  obtenerFechaActual,
  obtenerHoraActual,
} from './formatters';
export {
  isCodActividad,
  isCodDepartamento,
  isCodMunicipio,
  normalizeEmisorCodActividad,
} from './validators';
export { tiposDocumento, formasPago, unidadesMedida } from '../catalogos';

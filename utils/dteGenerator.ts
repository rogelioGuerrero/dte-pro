import { DatosFactura, DTEJSON, ItemFactura } from './types';
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

// Generar estructura JSON del DTE
export const generarDTE = (datos: DatosFactura, correlativo: number, ambiente: string = '00'): DTEJSON => {
  const uuid = generarUUID();
  const numeroControl = generarNumeroControl(datos.tipoDocumento, correlativo, datos.emisor.codEstableMH, datos.emisor.codPuntoVentaMH);

  // 1. Generar Cuerpo del Documento con redondeo a 8 decimales (Regla de la novena posición)
  const cuerpoDocumento: ItemFactura[] = datos.items.map((item, index) => {
    // Valores iniciales
    let precioUni = redondear(item.precioUni, 8);
    let ventaGravada = redondear(item.ventaGravada, 8);
    let montoDescu = redondear(item.montoDescu, 8);
    let ventaNoSuj = redondear(item.ventaNoSuj, 8);
    let ventaExenta = redondear(item.ventaExenta, 8);
    let ivaItem = 0;

    // Tributos: usar el código elegido en el ítem (tributoCodigo); default 20 solo en FE/CCF gravado
    const tributoCodigo = item.tributoCodigo ?? ((datos.tipoDocumento === '01' || datos.tipoDocumento === '03') && item.ventaGravada > 0 ? '20' : null);
    const aplicaIVA13 = (datos.tipoDocumento === '01' || datos.tipoDocumento === '03') && tributoCodigo === '20';

    if (datos.tipoDocumento === '01') {
      // FE: precios incluyen IVA. ventaGravada ya trae IVA incluido; ivaItem se extrae solo si aplica IVA 13%
      const base = ventaGravada > 0 ? redondear(ventaGravada / 1.13, 8) : 0;
      ivaItem = aplicaIVA13 && ventaGravada > 0 ? redondear(ventaGravada - base, 2) : 0;
      ventaGravada = ventaGravada; // permanece con IVA incluido
    } else {
      // CCF/otros: precios sin IVA
      ivaItem = aplicaIVA13 && ventaGravada > 0 ? redondear(ventaGravada * 0.13, 2) : 0;
    }

    const tributos = tributoCodigo ? [tributoCodigo] : null;

    return {
      ...item,
      numItem: index + 1,
      cantidad: redondear(item.cantidad, 8),
      precioUni: precioUni,
      montoDescu: montoDescu,
      ventaNoSuj: ventaNoSuj,
      ventaExenta: ventaExenta,
      ventaGravada: ventaGravada,
      tributos: tributos,
      tributoCodigo,
      numeroDocumento: item.numeroDocumento ?? null,
      codTributo: null,
      psv: item.psv ? redondear(item.psv, 2) : 0,
      noGravado: item.noGravado ? redondear(item.noGravado, 2) : 0,
      ivaItem,
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
    totalCargosNoBase,
    ivaPerci1,
    totalPagar,
  } = calcularTotales(cuerpoDocumento, datos.tipoDocumento);

  // Consolidar tributos: solo IVA 13% (código 20) por ahora, y solo para FE/CCF
  const aplicaIVAResumen = datos.tipoDocumento === '01' || datos.tipoDocumento === '03';
  const tributosResumen = aplicaIVAResumen && totalIva > 0
    ? [{ codigo: '20', descripcion: 'Impuesto al Valor Agregado 13%', valor: totalIva }]
    : null;

  const receptorIdDigits = (datos.receptor.nit || '').replace(/[\s-]/g, '').trim();
  const receptorSinDocumento = receptorIdDigits.length === 0;

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

  const dteJSON: DTEJSON = {
    identificacion: {
      version: datos.tipoDocumento === '01' ? 1 : 3,
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
      nombre: datos.emisor.nombre,
      codActividad: emisorCodActividad,
      descActividad: emisorDescActividad,
      nombreComercial: datos.emisor.nombreComercial || null,
      tipoEstablecimiento: datos.emisor.tipoEstablecimiento || '01',
      codEstable: datos.emisor.codEstableMH || null,
      codPuntoVenta: datos.emisor.codPuntoVentaMH || null,
      direccion: {
        departamento: datos.emisor.departamento,
        municipio: datos.emisor.municipio,
        complemento: datos.emisor.direccion,
      },
      telefono: datos.emisor.telefono,
      correo: datos.emisor.correo,
      codEstableMH: datos.emisor.codEstableMH || null,
      codPuntoVentaMH: datos.emisor.codPuntoVentaMH || null,
    },
    receptor: {
      tipoDocumento: receptorSinDocumento ? null : (receptorIdDigits.length === 9 ? '13' : '36'),
      numDocumento: receptorSinDocumento ? null : receptorIdDigits,
      nrc: receptorNrc || null,
      nombre: (datos.receptor.name || '').trim() ? datos.receptor.name : 'Consumidor Final',
      codActividad: receptorCodActividad,
      descActividad: receptorDescActividad,
      direccion: receptorDireccion,
      telefono: datos.receptor.telefono || null,
      correo: datos.receptor.email,
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
      totalIva,
      tributos: tributosResumen,
      subTotal,
      ivaRete1: 0,
      reteRenta: 0,
      montoTotalOperacion,
      totalNoGravado,
      totalCargosNoBase,
      ivaPerci1,
      totalPagar,
      totalLetras: numeroALetras(totalPagar),
      saldoFavor: 0,
      condicionOperacion: datos.condicionOperacion,
      pagos: datos.condicionOperacion === 1 ? [{
        codigo: datos.formaPago,
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
      observaciones: null,
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

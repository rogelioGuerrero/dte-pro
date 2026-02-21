import { ClientData } from './clientDb';
import { EmisorData } from './emisorDb';

export interface ItemFactura {
  numItem: number;
  tipoItem: number; // 1=Bienes, 2=Servicios
  cantidad: number;
  codigo: string | null;
  uniMedida: number;
  descripcion: string;
  precioUni: number;
  montoDescu: number;
  ventaNoSuj: number;
  ventaExenta: number;
  ventaGravada: number;
  tributos: string[] | null;
  numeroDocumento?: string | null;
  codTributo?: string | null;
  psv?: number;
  noGravado?: number;
  ivaItem?: number;
}

export interface DatosFactura {
  emisor: EmisorData;
  receptor: ClientData;
  items: ItemFactura[];
  tipoDocumento: string;
  tipoTransmision: number;
  formaPago: string;
  condicionOperacion: number;
  observaciones?: string;
}

export interface DTEJSON {
  identificacion: {
    version: number;
    ambiente: string;
    tipoDte: string;
    numeroControl: string;
    codigoGeneracion: string;
    tipoModelo: number;
    tipoOperacion: number;
    tipoContingencia: number | null;
    motivoContin: string | null;
    fecEmi: string;
    horEmi: string;
    tipoMoneda: string;
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
    codEstable: string | null;
    codPuntoVenta: string | null;
    direccion: {
      departamento: string;
      municipio: string;
      complemento: string;
    };
    telefono: string;
    correo: string;
    codEstableMH: string | null;
    codPuntoVentaMH: string | null;
  };
  receptor: {
    tipoDocumento: string | null;
    numDocumento: string | null;
    nrc: string | null;
    nombre: string;
    codActividad: string | null;
    descActividad: string | null;
    direccion: {
      departamento: string;
      municipio: string;
      complemento: string;
    } | null;
    telefono: string | null;
    correo: string;
  };
  otrosDocumentos: null;
  ventaTercero: null;
  cuerpoDocumento: ItemFactura[];
  resumen: {
    totalNoSuj: number;
    totalExenta: number;
    totalGravada: number;
    subTotalVentas: number;
    descuNoSuj: number;
    descuExenta: number;
    descuGravada: number;
    porcentajeDescuento: number;
    totalDescu: number;
    totalIva: number;
    tributos: Array<{
      codigo: string;
      descripcion: string;
      valor: number;
    }> | null;
    subTotal: number;
    ivaRete1: number;
    reteRenta: number;
    montoTotalOperacion: number;
    totalNoGravado: number;
    totalPagar: number;
    totalLetras: string;
    saldoFavor: number;
    condicionOperacion: number;
    pagos: Array<{
      codigo: string;
      montoPago: number;
      referencia: string | null;
      plazo: string | null;
      periodo: number | null;
    }> | null;
    numPagoElectronico: string | null;
  };
  extension: {
    nombEntrega: string | null;
    docuEntrega: string | null;
    nombRecibe: string | null;
    docuRecibe: string | null;
    observaciones: string | null;
    placaVehiculo: string | null;
  } | null;
  apendice: null;
}

const isCodActividad = (value: string | null | undefined): boolean => {
  if (!value) return false;
  return /^\d{5,6}$/.test(value.trim());
};

const isCodDepartamento = (value: string | null | undefined): boolean => {
  if (!value) return false;
  return /^(0[1-9]|1[0-4])$/.test(value.trim());
};

const isCodMunicipio = (value: string | null | undefined): boolean => {
  if (!value) return false;
  return /^(0[1-9]|[1-5]\d|6[0-8])$/.test(value.trim());
};

const normalizeEmisorCodActividad = (value: string | null | undefined): string => {
  const digits = (value || '').replace(/\D/g, '');
  if (digits === '96099') return '96090';
  return digits;
};


// Generar UUID v4
export const generarUUID = (): string => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16).toUpperCase();
  });
};

// Generar número de control según formato DTE
export const generarNumeroControl = (tipoDte: string, correlativo: number, codEstableMH: string | null, codPuntoVentaMH: string | null): string => {
  const tipoDoc = tipoDte.padStart(2, '0');
  const corr = correlativo.toString().padStart(15, '0');
  
  // Usar códigos MH si existen, sino fallback a valores por defecto
  const establecimiento = (codEstableMH || 'M001').padEnd(4, '0').slice(0, 4);
  const puntoVenta = (codPuntoVentaMH || 'P001').padEnd(4, '0').slice(0, 4);
  const segmentoMedio = `${establecimiento}${puntoVenta}`;
  
  return `DTE-${tipoDoc}-${segmentoMedio}-${corr}`;
};

// Redondeo según especificación AT (8 decimales para cantidades/precios)
export const redondear = (valor: number, decimales: number = 2): number => {
  const factor = Math.pow(10, decimales);
  // Primer paso: redondeo aritmético correcto (round half up)
  const rounded = Math.round((valor + Number.EPSILON) * factor) / factor;
  // Segundo paso: eliminar residuos de punto flotante (ej. 1.1000000000000001) asegurando la precisión fija
  return Number(rounded.toFixed(decimales));
};

// Convertir número a letras (simplificado)
export const numeroALetras = (num: number): string => {
  const unidades = ['', 'UN', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE'];
  const decenas = ['', 'DIEZ', 'VEINTE', 'TREINTA', 'CUARENTA', 'CINCUENTA', 'SESENTA', 'SETENTA', 'OCHENTA', 'NOVENTA'];
  const especiales = ['DIEZ', 'ONCE', 'DOCE', 'TRECE', 'CATORCE', 'QUINCE'];
  
  const entero = Math.floor(num);
  const centavos = Math.round((num - entero) * 100);
  
  if (entero === 0) return `CERO DÓLARES CON ${centavos.toString().padStart(2, '0')}/100 USD`;
  
  let resultado = '';
  
  if (entero >= 1000) {
    const miles = Math.floor(entero / 1000);
    resultado += miles === 1 ? 'MIL ' : `${unidades[miles]} MIL `;
  }
  
  const resto = entero % 1000;
  if (resto >= 100) {
    const centenas = Math.floor(resto / 100);
    if (centenas === 1 && resto % 100 === 0) {
      resultado += 'CIEN ';
    } else {
      const centenasTexto = ['', 'CIENTO', 'DOSCIENTOS', 'TRESCIENTOS', 'CUATROCIENTOS', 'QUINIENTOS', 'SEISCIENTOS', 'SETECIENTOS', 'OCHOCIENTOS', 'NOVECIENTOS'];
      resultado += centenasTexto[centenas] + ' ';
    }
  }
  
  const decenaUnidad = resto % 100;
  if (decenaUnidad > 0) {
    if (decenaUnidad < 10) {
      resultado += unidades[decenaUnidad];
    } else if (decenaUnidad < 16) {
      resultado += especiales[decenaUnidad - 10];
    } else if (decenaUnidad < 20) {
      resultado += 'DIECI' + unidades[decenaUnidad - 10].toLowerCase();
    } else {
      const d = Math.floor(decenaUnidad / 10);
      const u = decenaUnidad % 10;
      if (u === 0) {
        resultado += decenas[d];
      } else if (d === 2) {
        resultado += 'VEINTI' + unidades[u].toLowerCase();
      } else {
        resultado += decenas[d] + ' Y ' + unidades[u];
      }
    }
  }
  
  const moneda = entero === 1 ? 'DÓLAR' : 'DÓLARES';
  return `${resultado.trim()} ${moneda} CON ${centavos.toString().padStart(2, '0')}/100 USD`;
};

// Obtener fecha actual en formato ISO
export const obtenerFechaActual = (): string => {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/El_Salvador',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
};

// Obtener hora actual en formato HH:mm:ss
export const obtenerHoraActual = (): string => {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'America/El_Salvador',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(new Date());
};

// Calcular totales de items
export const calcularTotales = (items: ItemFactura[], tipoDocumento: string = '01') => {
  const totalGravada = items.reduce((sum, item) => sum + item.ventaGravada, 0);
  const totalExenta = items.reduce((sum, item) => sum + item.ventaExenta, 0);
  const totalNoSuj = items.reduce((sum, item) => sum + item.ventaNoSuj, 0);
  const totalDescu = items.reduce((sum, item) => sum + item.montoDescu, 0);
  
  const subTotalVentas = totalGravada + totalExenta + totalNoSuj;
  
  let iva = 0;
  let montoTotal = 0;

  if (tipoDocumento === '01') {
    // Factura (01): Precios incluyen IVA.
    // El IVA total es la suma de los IVAs calculados por ítem (informativo)
    
    // Si los items vienen de la UI, es posible que ivaItem sea 0.
    // Debemos calcular el IVA implícito para mostrarlo en el resumen.
    iva = items.reduce((sum, item) => {
      // Si ya tiene IVA calculado (ej. desde DB), usarlo
      if (item.ivaItem && item.ivaItem > 0) return sum + item.ivaItem;
      
      // Si no, calcularlo desde la venta gravada (que incluye IVA)
      // Base = Incluido / 1.13 -> IVA = Incluido - Base
      if (item.ventaGravada > 0) {
        const base = item.ventaGravada / 1.13;
        const itemIva = item.ventaGravada - base;
        return sum + itemIva;
      }
      return sum;
    }, 0);

    // En Factura, el IVA ya está en el subTotalVentas
    montoTotal = redondear(subTotalVentas - totalDescu, 2);
  } else {
    // CCF (03) y otros: Precios sin IVA.
    // El IVA se calcula sobre el total gravado
    iva = redondear(totalGravada * 0.13, 2);
    montoTotal = redondear(subTotalVentas + iva - totalDescu, 2);
  }
  
  return {
    totalNoSuj: redondear(totalNoSuj, 2),
    totalExenta: redondear(totalExenta, 2),
    totalGravada: redondear(totalGravada, 2),
    subTotalVentas: redondear(subTotalVentas, 2),
    totalDescu: redondear(totalDescu, 2),
    iva: redondear(iva, 2),
    montoTotal,
    totalPagar: montoTotal,
  };
};

// Generar estructura JSON del DTE
export const generarDTE = (datos: DatosFactura, correlativo: number, ambiente: string = '00'): DTEJSON => {
  const uuid = generarUUID();
  const numeroControl = generarNumeroControl(datos.tipoDocumento, correlativo, datos.emisor.codEstableMH, datos.emisor.codPuntoVentaMH);

  // 1. Generar Cuerpo del Documento con redondeo a 8 decimales (Regla de la novena posición)
  const cuerpoDocumento: ItemFactura[] = datos.items.map((item, index) => {
    // Valores iniciales (pueden incluir IVA o no según tipoDocumento)
    let precioUni = item.precioUni;
    let ventaGravada = item.ventaGravada;
    let montoDescu = item.montoDescu;
    let ventaNoSuj = item.ventaNoSuj;
    let ventaExenta = item.ventaExenta;
    
    let ivaItem = 0;
    
    // Lógica de Desglose de IVA
    if (datos.tipoDocumento === '01') {
      // FACTURA (01): Los valores de entrada INCLUYEN IVA.
      // El JSON debe reportar la BASE IMPONIBLE (Sin IVA).
      
      if (ventaGravada > 0) {
        // Extraer IVA de la Venta Gravada
        const gravadaConIva = ventaGravada;
        ventaGravada = redondear(gravadaConIva / 1.13, 8);
        
        // Extraer IVA del Precio Unitario
        // Nota: Si cantidad * precio != ventaGravada por decimales, esto mantiene consistencia unitaria
        precioUni = redondear(precioUni / 1.13, 8);
        
        // Extraer IVA del Descuento
        if (montoDescu > 0) {
          montoDescu = redondear(montoDescu / 1.13, 8);
        }

        // Calcular IVA del ítem sobre la nueva base
        ivaItem = redondear(ventaGravada * 0.13, 2);
      }
    } else {
      // CCF (03) y otros: Los valores de entrada SON SIN IVA (Base).
      // Se usan tal cual, solo asegurando redondeo.
      precioUni = redondear(precioUni, 8);
      ventaGravada = redondear(ventaGravada, 8);
      montoDescu = redondear(montoDescu, 8);
      ventaNoSuj = redondear(ventaNoSuj, 8);
      ventaExenta = redondear(ventaExenta, 8);
      
      // Calcular IVA sobre la base
      ivaItem = ventaGravada > 0 ? redondear(ventaGravada * 0.13, 2) : 0;
    }

    // Tributos: Requerido ['20'] si es gravado, para AMBOS tipos (01 y 03)
    const tributos = ventaGravada > 0 ? ['20'] : null;

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
      numeroDocumento: item.numeroDocumento ?? null,
      codTributo: null,
      psv: item.psv ? redondear(item.psv, 2) : 0,
      noGravado: item.noGravado ? redondear(item.noGravado, 2) : 0,
      ivaItem,
    };
  });

  // 2. Calcular Totales del Resumen basados en el Cuerpo ya procesado (Bases Imponibles)
  
  const sumGravada = cuerpoDocumento.reduce((sum, item) => sum + item.ventaGravada, 0);
  const sumExenta = cuerpoDocumento.reduce((sum, item) => sum + item.ventaExenta, 0);
  const sumNoSuj = cuerpoDocumento.reduce((sum, item) => sum + item.ventaNoSuj, 0);
  const sumDescu = cuerpoDocumento.reduce((sum, item) => sum + item.montoDescu, 0);
  
  const totalGravada = redondear(sumGravada, 2);
  const totalExenta = redondear(sumExenta, 2);
  const totalNoSuj = redondear(sumNoSuj, 2);
  const totalDescu = redondear(sumDescu, 2);

  const subTotalVentas = redondear(totalGravada + totalExenta + totalNoSuj, 2);

  // Cálculo de IVA Global
  // MH permite suma de IVAs de ítems o cálculo global. Usaremos cálculo global sobre totalGravada para consistencia con tributos.
  // Sin embargo, para Factura (01), si recalculamos globalmente (BaseTotal * 0.13), podría haber diferencias de centavos 
  // respecto a la suma original con IVA (TotalOriginal - BaseTotal).
  // Para evitar "saltos" de precio al cliente, lo ideal es: TotalPagar = TotalOriginal.
  // Pero el JSON se construye desde las bases.
  
  // Enfoque Híbrido Robusto:
  // 1. Calcular IVA teórico sobre la base total redondeada.
  let totalIva = redondear(totalGravada * 0.13, 2);
  
  // 2. Definir Tributos de Resumen (siempre que haya IVA)
  let tributosResumen: { codigo: string; descripcion: string; valor: number }[] | null = null;
  
  if (totalIva > 0) {
    tributosResumen = [{
      codigo: '20',
      descripcion: 'Impuesto al Valor Agregado 13%',
      valor: totalIva
    }];
  }

  // 3. Calcular Total a Pagar
  // Total = SubTotal + IVA - Retenciones + Otros
  // Nota: totalDescu ya se restó implícitamente si ventaGravada es neta, o explícitamente si no.
  // En este modelo, asumimos que ventaGravada ya tiene descuento aplicado línea a línea si se usó precio final.
  // Pero el campo 'montoDescu' es informativo.
  // Ajuste: La estructura estándar es SubTotal (suma de ventas) + Tributos - Retenciones.
  
  let montoTotalOperacion = redondear(subTotalVentas + totalIva, 2);
  
  // Manejo de Descuento Global (si aplicara) - Por ahora asumimos descuento de línea ya reflejado en ventaGravada
  // Si totalDescu se resta al final:
  // montoTotalOperacion = redondear(montoTotalOperacion - totalDescu, 2); 
  // (Depende de si ventaGravada es bruta o neta. Asumimos Neta según práctica común en items).

  let totalPagar = montoTotalOperacion;

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
      nit: datos.emisor.nit,
      nrc: datos.emisor.nrc,
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
      numDocumento: receptorSinDocumento ? null : datos.receptor.nit,
      nrc: datos.receptor.nrc || null,
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
      subTotal: subTotalVentas,
      ivaRete1: 0,
      reteRenta: 0,
      montoTotalOperacion,
      totalNoGravado: 0,
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
      observaciones: datos.observaciones || null,
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

// Re-exportar catálogos desde ubicación centralizada
export { tiposDocumento, formasPago, unidadesMedida } from '../catalogos';

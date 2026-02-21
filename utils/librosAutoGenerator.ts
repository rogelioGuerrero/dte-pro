// Generador automático de libros IVA desde DTEs transmitidos en IndexedDB
// Elimina necesidad de subir JSONs manualmente

import { obtenerHistorialDTE, DTEHistoryRecord } from './dteHistoryDb';
import { saveLibroData, getLibroData } from './libroLegalDb';
import { GroupedData, ProcessedFile } from '../types';
import { notify } from './notifications';
import { loadSettings } from './settings';

export interface LibroAutoConfig {
  modo: 'compras' | 'ventas';
  periodo: string; // YYYY-MM
  incluirRechazados: boolean;
  incluirPendientes: boolean;
}

export interface LibroGeneradoResult {
  periodo: string;
  modo: string;
  totalRegistros: number;
  registrosAceptados: number;
  registrosRechazados: number;
  registrosPendientes: number;
  registrosContingencia: number;
  montoTotal: number;
  montoIVA: number;
  fechaGeneracion: string;
}

const getOwnerTaxpayer = () => {
  const settings = loadSettings();
  return {
    nombre: 'CONTRIBUYENTE',
    nit: settings.myNit || '',
    nrc: settings.myNrc || '',
  };
};

const normalizeId = (id: string): string => {
  return (id || '').toString().replace(/[\s-]/g, '').trim();
};

// Determinar si un DTE es de compra o venta
const esDTECompra = (record: DTEHistoryRecord): boolean => {
  const settings = loadSettings();
  const myNit = normalizeId(settings.myNit || '');
  const myNrc = normalizeId(settings.myNrc || '');

  const emisorNit = normalizeId(record?.dteJson?.emisor?.nit || record.emisorNit || '');
  const emisorNrc = normalizeId(record?.dteJson?.emisor?.nrc || '');
  const receptorNit = normalizeId(record?.dteJson?.receptor?.numDocumento || record.receptorDocumento || '');
  const receptorNrc = normalizeId(record?.dteJson?.receptor?.nrc || '');

  const isMyCompanyEmitter = (myNit && emisorNit === myNit) || (myNrc && emisorNrc === myNrc);
  const isMyCompanyReceiver = (myNit && receptorNit === myNit) || (myNrc && receptorNrc === myNrc);

  // Si yo soy receptor (y no soy emisor) => compra. Si yo soy emisor => venta.
  if (isMyCompanyReceiver && !isMyCompanyEmitter) return true;
  return false;
};

// Convertir DTEHistoryRecord a ProcessedFile (formato esperado por libros)
const convertirDTEAProcessedFile = (record: DTEHistoryRecord): ProcessedFile => {
  const isCompra = esDTECompra(record);
  const owner = getOwnerTaxpayer();

  const counterpartyNombre = isCompra ? record.emisorNombre : record.receptorNombre;

  // Extraer datos del DTE JSON para el CSV
  const csvParts = [
    record.fechaEmision, // Fecha
    record.tipoDte === '01' ? 'FACTURA' : record.tipoDte === '03' ? 'LIQUIDACION' : 'NOTA_CREDITO', // Tipo
    record.numeroControl, // Número de control
    record.codigoGeneracion, // Código de generación
    record.emisorNit, // NIT emisor
    record.emisorNombre, // Nombre emisor
    record.receptorDocumento, // Documento receptor
    record.receptorNombre, // Nombre receptor
    '0.00', // Ventas exentas (por ahora)
    record.montoGravado.toString(), // Ventas gravadas
    '0.00', // Exportaciones
    record.montoIva.toString(), // IVA
    record.montoTotal.toString(), // Total
    record.estado, // Estado
    record.selloRecepcion || '', // Sello recepción
    record.fechaTransmision // Fecha transmisión
  ];

  return {
    id: record.codigoGeneracion,
    fileName: `DTE_${record.codigoGeneracion}.json`,
    month: record.fechaEmision.substring(5, 7),
    csvLine: csvParts.join(';'),
    data: {
      date: record.fechaEmision,
      controlNumber: record.numeroControl,
      receiver: counterpartyNombre,
      total: record.montoTotal.toString(),
      neto: record.montoGravado.toString(),
      iva: record.montoIva.toString(),
      exentas: '0.00',
      descuentos: record.descuentos?.toString() || '0.00'
    },
    taxpayer: owner,
    dteType: record.tipoDte,
    isValid: record.estado === 'ACEPTADO',
    isOutOfTime: false, // Determinar según lógica de tiempo
    detectedMode: isCompra ? 'compras' : 'ventas',
  };
};

// Generar libro automáticamente desde DTEs transmitidos
export const generarLibroDesdeDTEs = async (
  config: LibroAutoConfig
): Promise<LibroGeneradoResult> => {
  try {
    // Obtener DTEs del período
    const { registros } = await obtenerHistorialDTE({
      fechaDesde: `${config.periodo}-01`,
      fechaHasta: `${config.periodo}-31`,
      limite: 1000 // Límite razonable
    });

    // Filtrar por modo (compras/ventas) y estado
    const registrosFiltrados = registros.filter(record => {
      if ((record as any)?.anulacionLocal) return false;
      const esCompra = esDTECompra(record);
      const modoCorrecto = config.modo === 'compras' ? esCompra : !esCompra;
      
      if (!modoCorrecto) return false;
      
      // Filtrar por estado
      if (!config.incluirRechazados && record.estado === 'RECHAZADO') return false;
      if (!config.incluirPendientes && record.estado === 'PENDIENTE') return false;
      
      return true;
    });

    // Convertir a formato ProcessedFile
    const processedFiles: ProcessedFile[] = registrosFiltrados.map(record => {
      // Extraer descuentos del DTE JSON si existen - usar totalDescu para DGII
      const descuentos = record.dteJson?.resumen?.totalDescu || 0;
      return convertirDTEAProcessedFile({ ...record, descuentos });
    });

    // Agrupar por mes (solo un mes en este caso)
    const groupedData: GroupedData = {
      [config.periodo]: processedFiles
    };

    // Guardar en IndexedDB de libros
    await saveLibroData(config.modo, config.periodo, groupedData);

    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('dte-libros-updated', {
          detail: { modo: config.modo, periodo: config.periodo },
        })
      );
    }

    // Calcular estadísticas
    const result: LibroGeneradoResult = {
      periodo: config.periodo,
      modo: config.modo,
      totalRegistros: registrosFiltrados.length,
      registrosAceptados: registrosFiltrados.filter(r => r.estado === 'ACEPTADO').length,
      registrosRechazados: registrosFiltrados.filter(r => r.estado === 'RECHAZADO').length,
      registrosPendientes: registrosFiltrados.filter(r => r.estado === 'PENDIENTE').length,
      registrosContingencia: registrosFiltrados.filter(r => r.estado === 'CONTINGENCIA').length,
      montoTotal: registrosFiltrados.reduce((sum, r) => sum + r.montoTotal, 0),
      montoIVA: registrosFiltrados.reduce((sum, r) => sum + r.montoIva, 0),
      fechaGeneracion: new Date().toISOString()
    };

    notify(`Libro ${config.modo} generado: ${result.totalRegistros} registros`, 'success');
    
    return result;
  } catch (error) {
    console.error('Error generando libro desde DTEs:', error);
    notify('Error al generar libro automáticamente', 'error');
    throw error;
  }
};

// Obtener períodos disponibles para generación
export const getPeriodosDisponibles = async (modo: 'compras' | 'ventas'): Promise<string[]> => {
  try {
    const { registros } = await obtenerHistorialDTE({ limite: 10000 });
    
    // Agrupar por mes y filtrar por modo
    const periodos = new Set<string>();
    
    for (const record of registros) {
      const esCompra = esDTECompra(record);
      const modoCorrecto = modo === 'compras' ? esCompra : !esCompra;
      
      if (modoCorrecto) {
        const periodo = record.fechaEmision.substring(0, 7); // YYYY-MM
        periodos.add(periodo);
      }
    }
    
    return Array.from(periodos).sort().reverse(); // Más recientes primero
  } catch (error) {
    console.error('Error obteniendo períodos disponibles:', error);
    return [];
  }
};

// Verificar si un libro ya existe para un período
export const existeLibroParaPeriodo = async (
  modo: 'compras' | 'ventas',
  periodo: string
): Promise<boolean> => {
  try {
    const libroExistente = await getLibroData(modo, periodo);
    return libroExistente !== null;
  } catch (error) {
    console.error('Error verificando libro existente:', error);
    return false;
  }
};

// Generar libros para múltiples períodos
export const generarLibrosMultiplesPeriodos = async (
  modo: 'compras' | 'ventas',
  periodos: string[],
  opciones: Partial<LibroAutoConfig> = {}
): Promise<LibroGeneradoResult[]> => {
  const resultados: LibroGeneradoResult[] = [];
  
  for (const periodo of periodos) {
    const config: LibroAutoConfig = {
      modo,
      periodo,
      incluirRechazados: opciones.incluirRechazados ?? false,
      incluirPendientes: opciones.incluirPendientes ?? false
    };
    
    try {
      const resultado = await generarLibroDesdeDTEs(config);
      resultados.push(resultado);
    } catch (error) {
      console.error(`Error generando libro para ${periodo}:`, error);
      // Continuar con siguiente período
    }
  }
  
  return resultados;
};

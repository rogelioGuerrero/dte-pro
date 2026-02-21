import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Printer, Download, ChevronLeft, ChevronRight, BookOpen } from 'lucide-react';
import { GroupedData, ProcessedFile } from '../../types';
import { getEmisor, EmisorData } from '../../utils/emisorDb';
import { consumeExportSlot } from '../../utils/usageLimit';
import { notify } from '../../utils/notifications';
import { TipoLibro, getConfigLibro, formatMoneda } from './librosConfig';

interface LibroLegalViewerProps {
  groupedData: GroupedData;
  groupedDataForResumen?: GroupedData;
  tipoLibro: TipoLibro;
}

const MESES = [
  'ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO',
  'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'
];

const getSucursalLabelFromNumeroControl = (numeroControl?: string): string | null => {
  if (!numeroControl) return null;
  const match = numeroControl.match(/-(M|S)(\d{3})/);
  if (!match) return null;

  const tipo = match[1];
  const correlativo = match[2]; // Mantener ceros a la izquierda (ej: 001)

  return tipo === 'M' ? `Casa Matriz ${correlativo}` : `SUCURSAL ${correlativo}`;
};

const LibroLegalViewer: React.FC<LibroLegalViewerProps> = ({ groupedData, groupedDataForResumen, tipoLibro }) => {
  const [emisor, setEmisor] = useState<EmisorData | null>(null);
  const [selectedMonthIndex, setSelectedMonthIndex] = useState<number>(0);
  const libroRef = useRef<HTMLDivElement>(null);
  
  const config = useMemo(() => {
    const cfg = getConfigLibro(tipoLibro);
    if (!cfg) {
      console.error(`Configuración no encontrada para tipoLibro: ${tipoLibro}`);
    }
    return cfg;
  }, [tipoLibro]);

  // Si no hay config, mostrar mensaje de error
  if (!config) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-red-200 p-8 text-center">
        <BookOpen className="w-12 h-12 text-red-300 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-red-900 mb-2">Error de Configuración</h3>
        <p className="text-red-500 text-sm">
          No se encontró la configuración para el tipo de libro: {tipoLibro}
        </p>
      </div>
    );
  }

  // Cargar datos del emisor
  useEffect(() => {
    getEmisor().then(setEmisor);
  }, []);

  // Obtener el mes anterior al actual para el título (solo para compras)
  const getPreviousMonth = () => {
    const now = new Date();
    const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const year = prevMonth.getFullYear();
    const month = String(prevMonth.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  };

  // Para compras: consolidar todos los archivos válidos de los últimos 3 meses
  const consolidatedItems = useMemo(() => {
    if (tipoLibro !== 'compras') {
      return null; // Para otros tipos, usar el comportamiento normal
    }

    // Consolidar todos los archivos no fuera de tiempo
    const allValidFiles: ProcessedFile[] = [];
    
    Object.entries(groupedData).forEach(([, files]) => {
      const validFiles = files.filter(file => !file.isOutOfTime);
      allValidFiles.push(...validFiles);
    });

    // Ordenar todos por fecha
    allValidFiles.sort((a, b) => {
      const dateA = new Date(a.data.date.split('/').reverse().join('-'));
      const dateB = new Date(b.data.date.split('/').reverse().join('-'));
      return dateA.getTime() - dateB.getTime();
    });

    return allValidFiles;
  }, [groupedData, tipoLibro]);

  // Meses disponibles ordenados (solo para no-compras)
  const availableMonths = useMemo(() => {
    if (tipoLibro === 'compras') {
      return [getPreviousMonth()]; // Para compras, solo mostrar el mes anterior
    }
    return Object.keys(groupedData).sort();
  }, [groupedData, tipoLibro]);

  // Mes seleccionado actual
  const selectedMonth = availableMonths[selectedMonthIndex] || null;
  
  // Determinar si es vista consolidada
  const isConsolidatedView = tipoLibro === 'compras';
  
  // Obtener el mes a mostrar en el título
  const displayMonth = isConsolidatedView ? getPreviousMonth() : selectedMonth;

  // Determinar datos del contribuyente (Dueño del Libro)
  const currentTaxpayer = useMemo(() => {
    if (isConsolidatedView && consolidatedItems && consolidatedItems.length > 0) {
      // Para compras consolidadas: usar el primer archivo válido
      const fileWithInfo = consolidatedItems.find(f => f.taxpayer?.nombre);
      if (fileWithInfo?.taxpayer) {
        return {
          ...emisor,
          nombre: fileWithInfo.taxpayer.nombre,
          nit: fileWithInfo.taxpayer.nit,
          nrc: fileWithInfo.taxpayer.nrc,
          nombreComercial: emisor?.nombreComercial || '',
        } as EmisorData;
      }
      return emisor;
    }
    
    if (!selectedMonth || !groupedData[selectedMonth] || groupedData[selectedMonth].length === 0) {
      return emisor;
    }
    // Usar la info del primer archivo válido que tenga taxpayer info
    const fileWithInfo = groupedData[selectedMonth].find(f => f.taxpayer?.nombre);
    if (fileWithInfo?.taxpayer) {
      return {
        ...emisor, // Fallback a otros datos si faltan (direccion, etc)
        nombre: fileWithInfo.taxpayer.nombre,
        nit: fileWithInfo.taxpayer.nit,
        nrc: fileWithInfo.taxpayer.nrc,
        nombreComercial: emisor?.nombreComercial || '', // Mantener comercial si existe en global, o vacío
      } as EmisorData;
    }
    return emisor;
  }, [selectedMonth, groupedData, emisor, isConsolidatedView, consolidatedItems]);

  const sucursalLabel = useMemo(() => {
    const file = isConsolidatedView
      ? consolidatedItems?.[0]
      : (selectedMonth ? groupedData[selectedMonth]?.[0] : undefined);

    return getSucursalLabelFromNumeroControl(file?.data?.controlNumber);
  }, [isConsolidatedView, consolidatedItems, selectedMonth, groupedData]);

  // Generar items del libro según el tipo
  const items = useMemo(() => {
    if (isConsolidatedView) {
      // Para compras consolidadas
      if (!consolidatedItems || consolidatedItems.length === 0) return [];
      
      return consolidatedItems.map((file, index) => {
      const csvParts = file.csvLine.split(';');
      const tipoDTE = file.data.tipoDTE || '03'; // Obtener tipo de DTE desde JSON
      
      // Determinar si es nota de crédito (05) o débito (06)
      const esNotaCredito = tipoDTE === '05';
      const esNotaDebito = tipoDTE === '06';
      const multiplicador = esNotaCredito ? -1 : 1;
      
      const exentas = parseFloat(file.data.exentas || '0') * multiplicador;
      const neto = parseFloat(file.data.neto || '0') * multiplicador;
      const iva = parseFloat(file.data.iva || '0') * multiplicador;
      const total = parseFloat(file.data.total || '0') * multiplicador;
      
      return {
        correlativo: index + 1,
        fecha: file.data.date,
        codigoGeneracion: csvParts[3] || '',
        numeroControl: file.data.controlNumber, // Agregar para CSV
        selloRecibido: file.data.selloRecibido || '', // Agregar para CSV
        nrc: '',
        nitSujetoExcluido: '',
        nombreProveedor: file.data.receiver,
        comprasExentas: exentas,
        comprasGravadasLocales: neto,
        creditoFiscal: iva,
        totalCompras: total,
        retencionTerceros: 0,
        comprasSujetoExcluido: 0,
        tipoDTE: tipoDTE, // Agregar para visualización y CSV
        esNotaCredito: esNotaCredito,
        esNotaDebito: esNotaDebito,
      };
    });
    }
    
    // Comportamiento normal para otros casos
    if (!selectedMonth || !groupedData[selectedMonth]) return [];

    const monthFiles = [...groupedData[selectedMonth]];

    // Ordenar por fecha
    monthFiles.sort((a, b) => {
      const dateA = new Date(a.data.date.split('/').reverse().join('-'));
      const dateB = new Date(b.data.date.split('/').reverse().join('-'));
      return dateA.getTime() - dateB.getTime();
    });

    // Procesamiento especial para libro consumidor
    if (tipoLibro === 'consumidor') {
      // Agrupar DTEs por fecha y consolidar rangos
      const filasAgrupadas: { [key: string]: any } = {};
      
      monthFiles.forEach((file) => {
        const numeroControl = file.data.controlNumber || '';
        const codigoGeneracion = file.data.codigoGeneracion || '';
        const tipoDTE = file.data.tipoDTE || '01'; // Obtener tipo de DTE desde JSON
        
        // Determinar si es nota de crédito (05) o débito (06)
        const esNotaCredito = tipoDTE === '05';
        const esNotaDebito = tipoDTE === '06';
        const multiplicador = esNotaCredito ? -1 : 1;
        
        const ventasExentas = parseFloat(file.data.exentas || '0') * multiplicador;
        const ventasInternasExentas = 0; // No viene en JSON para consumidor
        const ventasNoSujetas = 0; // No viene en JSON para consumidor
        const ventasGravadas = parseFloat(file.data.neto || '0') * multiplicador; // Usar neto del JSON
        const ventaTotal = parseFloat(file.data.total || '0') * multiplicador;
        const descuentos = parseFloat(file.data.descuentos || '0') * multiplicador; // Extraer descuentos para DGII
        
        // Formatear fecha: DD/MM/YYYY (con ceros)
        const fechaParts = file.data.date.split('/');
        const dia = parseInt(fechaParts[0], 10).toString().padStart(2, '0');
        const mes = parseInt(fechaParts[1], 10).toString().padStart(2, '0');
        const anio = fechaParts[2];
        const fechaFormateada = `${dia}/${mes}/${anio}`;
        
        // Si no existe la fecha, crear nueva entrada
        if (!filasAgrupadas[fechaFormateada]) {
          filasAgrupadas[fechaFormateada] = {
            fecha: fechaFormateada,
            codigosGeneracion: [],
            numerosControl: [],
            selloRecibido: file.data.selloRecibido || '',
            ventasExentas: 0,
            ventasInternasExentas: 0,
            ventasNoSujetas: 0,
            ventasGravadas: 0,
            descuentos: 0, // Inicializar campo de descuentos para DGII
            exportacionesCentroAmerica: 0,
            exportacionesFueraCentroAmerica: 0,
            exportacionesServicios: 0,
            ventasZonasFrancas: 0,
            ventasCuentaTerceros: 0,
            ventaTotal: 0,
            tieneNotas: false, // Rastrear si hay notas en esta fecha
          };
        }
        
        // Acumular valores para la fecha
        const fila = filasAgrupadas[fechaFormateada];
        fila.codigosGeneracion.push(codigoGeneracion);
        fila.numerosControl.push(numeroControl);
        fila.ventasExentas += ventasExentas;
        fila.ventasInternasExentas += ventasInternasExentas;
        fila.ventasNoSujetas += ventasNoSujetas;
        fila.ventasGravadas += ventasGravadas;
        fila.descuentos += descuentos; // Acumular descuentos para DGII
        fila.ventaTotal += ventaTotal;
        
        // Marcar si hay notas de crédito/débito
        if (esNotaCredito || esNotaDebito) {
          fila.tieneNotas = true;
        }
      });
      
      // Convertir a array y establecer rangos
      const filasFinales = Object.values(filasAgrupadas).map((fila: any) => {
        // Ordenar códigos de generación numéricamente
        const codigosOrdenados = [...fila.codigosGeneracion].sort((a, b) => {
          const numA = parseInt(a.replace(/[^0-9]/g, ''), 10) || 0;
          const numB = parseInt(b.replace(/[^0-9]/g, ''), 10) || 0;
          return numA - numB;
        });
        
        // Ordenar números de control numéricamente
        const controlesOrdenados = [...fila.numerosControl].sort((a, b) => {
          const numA = parseInt(a.split('-').pop() || '0', 10);
          const numB = parseInt(b.split('-').pop() || '0', 10);
          return numA - numB;
        });
        
        return {
          fecha: fila.fecha,
          codigoGeneracionInicial: codigosOrdenados[0] || '',
          codigoGeneracionFinal: codigosOrdenados[codigosOrdenados.length - 1] || '',
          numeroControlDel: controlesOrdenados[0] || '',
          numeroControlAl: controlesOrdenados[controlesOrdenados.length - 1] || '',
          selloRecibido: fila.selloRecibido,
          ventasExentas: fila.ventasExentas,
          ventasInternasExentas: fila.ventasInternasExentas,
          ventasNoSujetas: fila.ventasNoSujetas,
          ventasGravadas: fila.ventasGravadas,
          exportacionesCentroAmerica: fila.exportacionesCentroAmerica,
          exportacionesFueraCentroAmerica: fila.exportacionesFueraCentroAmerica,
          exportacionesServicios: fila.exportacionesServicios,
          ventasZonasFrancas: fila.ventasZonasFrancas,
          ventasCuentaTerceros: fila.ventasCuentaTerceros,
          ventaTotal: fila.ventaTotal,
          tieneNotas: fila.tieneNotas || false, // Indicar si hay notas en esta fecha
        };
      });

      // Ordenar las filas por fecha
      filasFinales.sort((a, b) => {
        const fechaA = new Date(a.fecha.split('/').reverse().join('-'));
        const fechaB = new Date(b.fecha.split('/').reverse().join('-'));
        return fechaA.getTime() - fechaB.getTime();
      });

      return filasFinales;
    }

    // Para otros tipos de libros (contribuyentes)
    return monthFiles.map((file, index) => {
      const tipoDTE = file.data.tipoDTE || '01'; // Obtener tipo de DTE desde JSON
      
      // Determinar si es nota de crédito (05) o débito (06)
      const esNotaCredito = tipoDTE === '05';
      const esNotaDebito = tipoDTE === '06';
      const multiplicador = esNotaCredito ? -1 : 1;
      
      // Nota: aquí tipoLibro NO puede ser 'compras' porque esa ruta retorna arriba.
      if (tipoLibro === 'contribuyentes') {
        return {
          correlativo: index + 1,
          fecha: file.data.date,
          codigoGeneracion: file.data.codigoGeneracion || '', // Del JSON
          formUnico: '',
          cliente: file.data.receiver,
          nrc: '', // Para contribuyentes, esto viene de otra fuente
          ventasExentas: parseFloat(file.data.exentas || '0') * multiplicador, // Del JSON
          ventasNoSujetas: 0, // No viene en JSON para contribuyentes
          ventasGravadas: parseFloat(file.data.neto || '0') * multiplicador, // Del JSON
          debitoFiscal: parseFloat(file.data.iva || '0') * multiplicador, // Del JSON
          ventaCuentaTerceros: 0,
          debitoFiscalTerceros: 0,
          impuestoPercibido: 0,
          ventasTotales: parseFloat(file.data.total) * multiplicador,
          dui: '', // Para contribuyentes, esto viene de otra fuente
          tipoDTE: tipoDTE, // Agregar tipo de DTE para visualización
          esNotaCredito: esNotaCredito,
          esNotaDebito: esNotaDebito,
          numeroControlDel: file.data.controlNumber, // Para columna D
          selloRecibido: file.data.selloRecibido || '', // Del JSON
        };
      }

      return {};
    });
  }, [selectedMonth, groupedData, tipoLibro, isConsolidatedView, consolidatedItems]);

  const consumidorTotalesParaResumen = useMemo(() => {
    if (tipoLibro !== 'contribuyentes') return null;
    const fuente = groupedDataForResumen || groupedData;
    if (!selectedMonth || !fuente[selectedMonth]) return null;

    const monthFiles = [...fuente[selectedMonth]];
    let totalBrutoGravadoConsumidor = 0;

    monthFiles.forEach(file => {
      // Consumidor final: Factura (tipoDte 01)
      if (file.dteType !== '01') return;

      // Para consumidor final, el monto viene como bruto (incluye IVA).
      // Usamos el total como base para el cálculo inverso (igual que el Libro Consumidor).
      const bruto = parseFloat(file.data?.total || '0');
      totalBrutoGravadoConsumidor += bruto;
    });

    const valorNeto = totalBrutoGravadoConsumidor / 1.13;
    const debitoFiscal = totalBrutoGravadoConsumidor - valorNeto;

    return {
      valorNeto,
      debitoFiscal,
    };
  }, [tipoLibro, selectedMonth, groupedData, groupedDataForResumen]);

  // Calcular totales usando la config
  const totales = useMemo(() => {
    return config.calcularTotales(items);
  }, [items, config]);

  // Generar filas de resumen dinámico
  const resumenFilas = useMemo<any[]>(() => {
    if (config.getResumen) {
      const resumen = config.getResumen(items);

      if (tipoLibro === 'contribuyentes' && consumidorTotalesParaResumen) {
        const rows = resumen.map((row: any) => {
          const label = (row?.label || '').toString().trim().toUpperCase();
          if (label === 'VENTAS NETAS INTERNAS GRAVADAS A CONSUMIDORES') {
            return {
              ...row,
              valorNeto: consumidorTotalesParaResumen.valorNeto,
              debitoFiscal: consumidorTotalesParaResumen.debitoFiscal,
            };
          }
          return row;
        });

        const getRow = (labelToFind: string) => {
          const key = labelToFind.trim().toUpperCase();
          return rows.find((r: any) => (r?.label || '').toString().trim().toUpperCase() === key);
        };

        const rowContrib = getRow('VENTAS NETAS INTERNAS GRAVADAS A CONTRIBUYENTES');
        const rowTotal = getRow('TOTAL OPERACIONES INTERNADAS GRAVADAS');
        if (rowContrib && rowTotal) {
          const netoTotal = (rowContrib.valorNeto || 0) + consumidorTotalesParaResumen.valorNeto;
          const debitoTotal = (rowContrib.debitoFiscal || 0) + consumidorTotalesParaResumen.debitoFiscal;

          rowTotal.valorNeto = netoTotal;
          rowTotal.debitoFiscal = debitoTotal;
        }

        return rows;
      }

      return resumen;
    }
    return [];
  }, [config, items, tipoLibro, consumidorTotalesParaResumen]);

  const getNombreMes = (monthKey: string): string => {
    const monthNum = parseInt(monthKey.split('-')[1], 10);
    return MESES[monthNum - 1] || monthKey;
  };

  const getAnio = (monthKey: string): number => {
    return parseInt(monthKey.split('-')[0], 10);
  };

  const handlePrevMonth = () => {
    if (isConsolidatedView) return; // No permitir navegación en vista consolidada
    setSelectedMonthIndex(prev => Math.max(0, prev - 1));
  };

  const handleNextMonth = () => {
    if (isConsolidatedView) return; // No permitir navegación en vista consolidada
    setSelectedMonthIndex(prev => Math.min(availableMonths.length - 1, prev + 1));
  };

  const handlePrint = () => {
    if (!libroRef.current) return;
    
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const libroContent = libroRef.current.innerHTML;
    const printStyles = `
      <style>
        @page { size: landscape; margin: 10mm; }
        body { font-family: 'Arial', sans-serif; margin: 0; padding: 20px; color: #111; }
        
        /* Layout Utilities */
        .flex { display: flex !important; }
        .justify-between { justify-content: space-between !important; }
        .items-start { align-items: flex-start !important; }
        .items-center { align-items: center !important; }
        .gap-2 { gap: 0.5rem !important; }
        .gap-8 { gap: 2rem !important; }
        .flex-1 { flex: 1 1 0% !important; }
        .w-full { width: 100% !important; }
        .h-16 { height: 4rem !important; }
        .mb-2 { margin-bottom: 0.5rem !important; }
        .mb-4 { margin-bottom: 1rem !important; }
        .mb-6 { margin-bottom: 1.5rem !important; }
        .mt-2 { margin-top: 0.5rem !important; }
        .mt-8 { margin-top: 2rem !important; }
        .space-y-1 > * + * { margin-top: 0.25rem !important; }
        
        /* Typography */
        .text-center { text-align: center !important; }
        .text-right { text-align: right !important; }
        .text-left { text-align: left !important; }
        .font-bold { font-weight: bold !important; }
        .font-semibold { font-weight: 600 !important; }
        .text-xl { font-size: 1.25rem !important; line-height: 1.75rem !important; }
        .text-lg { font-size: 1.125rem !important; line-height: 1.75rem !important; }
        .text-sm { font-size: 0.875rem !important; line-height: 1.25rem !important; }
        .text-xs { font-size: 0.75rem !important; line-height: 1rem !important; }
        .uppercase { text-transform: uppercase !important; }
        .font-mono { font-family: monospace !important; font-size: 8px !important; }
        
        /* Borders & Colors */
        .border-b { border-bottom: 1px solid #e5e7eb !important; }
        .border-t { border-top: 1px solid #e5e7eb !important; }
        .border-b-2 { border-bottom: 2px solid #1f2937 !important; }
        .border-t-2 { border-top: 2px solid #1f2937 !important; }
        .border-r { border-right: 1px solid #ccc !important; }
        .border { border: 1px solid #ccc !important; }
        .border-gray-800 { border-color: #1f2937 !important; }
        .border-gray-300 { border-color: #d1d5db !important; }
        .bg-gray-100 { background-color: #f3f4f6 !important; }
        
        /* Table Styles */
        table { width: 100%; border-collapse: collapse; font-size: 9px; margin-top: 1rem; }
        th, td { border: 1px solid #ccc; padding: 3px 5px; }
        th { background-color: #f3f4f6; font-weight: bold; page-break-inside: avoid; }
        tr { page-break-inside: avoid; }
        
        /* Specific Print Adjustments */
        .print-signature { margin-top: 40px; }
        .resumen-table { margin-top: 20px; font-size: 9px; }
        h1 { margin: 0; }
        h2 { margin: 0; }
      </style>
    `;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${config.titulo} - ${displayMonth || ''}</title>
          ${printStyles}
        </head>
        <body>
          ${libroContent}
        </body>
      </html>
    `);
    
    printWindow.document.close();
    
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 250);
  };

  const handleExportCSV = async () => {
    if (!displayMonth) return;

    // Verificar límite de exportaciones
    const slot = await consumeExportSlot();
    if (!slot.allowed) {
      notify(slot.message || 'No se puede exportar. Límite alcanzado.', 'error');
      return;
    }
    
    const csv = config.generarCSV(items, totales, resumenFilas);
    
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    const fileName = isConsolidatedView ? `LIBRO_COMPRAS_CONSOLIDADO.csv` : `${config.nombreArchivo}_${displayMonth}.csv`;
    link.download = fileName;
    link.click();
  };

  if (availableMonths.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
        <BookOpen className="w-12 h-12 text-gray-300 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-gray-900 mb-2">No hay datos disponibles</h3>
        <p className="text-gray-500 text-sm">
          Sube archivos JSON primero para ver el {config.titulo}.
        </p>
      </div>
    );
  }

  // Renderizar celda según formato
  const renderCelda = (valor: any, formato?: string, item?: any, colKey?: string) => {
    // Determinar si es nota de crédito/débito para formato especial
    const esNotaCredito = item?.esNotaCredito;
    const esNotaDebito = item?.esNotaDebito;
    
    // Si es la columna fecha, mostrar solo el día para UI humana
    if (colKey === 'fecha' && valor) {
      const dia = valor.split('/')[0];
      return <span className="text-center">{dia}</span>;
    }
    
    if (formato === 'moneda') {
      const valorNumerico = Number(valor) || 0;
      const esNegativo = valorNumerico < 0;
      
      // Aplicar colores para notas de crédito/débito
      let className = '';
      if (esNotaCredito) {
        className = 'text-green-600'; // Verde para crédito
      } else if (esNotaDebito) {
        className = 'text-red-600'; // Rojo para débito
      } else if (esNegativo) {
        className = 'text-red-600'; // Rojo para valores negativos
      }
      
      return (
        <span className={className}>
          {formatMoneda(valor)}
        </span>
      );
    }
    
    if (formato === 'codigo') {
      return <span className="font-mono text-[10px]">{valor}</span>;
    }
    
    // Mostrar icono para tipo de DTE
    if (item?.tipoDTE) {
      let icono = '';
      let className = '';
      
      switch (item.tipoDTE) {
        case '05':
          icono = '📄';
          className = 'text-green-600';
          break;
        case '06':
          icono = '📄';
          className = 'text-red-600';
          break;
        default:
          return valor || '';
      }
      
      return (
        <span className={className}>
          {icono} {valor || ''}
        </span>
      );
    }
    
    return valor || '';
  };

  return (
    <div className="space-y-4">
      {/* Controles de navegación y acciones */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-4 rounded-xl shadow-sm border border-gray-200">
        <div className="flex items-center gap-2">
          {!isConsolidatedView && (
            <button
              onClick={handlePrevMonth}
              disabled={selectedMonthIndex === 0}
              className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
          )}
          <div className="text-center min-w-[180px]">
            <div className="text-sm text-gray-500">Período</div>
            <div className="font-semibold text-gray-900">
              {displayMonth ? `${getNombreMes(displayMonth)} ${getAnio(displayMonth)}` : '---'}
            </div>
            {isConsolidatedView && (
              <div className="text-xs text-blue-600 font-medium mt-1">
                Consolidado 3 meses válidos
              </div>
            )}
          </div>
          {!isConsolidatedView && (
            <button
              onClick={handleNextMonth}
              disabled={selectedMonthIndex === availableMonths.length - 1}
              className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          )}
        </div>

        {!isConsolidatedView && (
          <div className="text-sm text-gray-500">
            {selectedMonthIndex + 1} de {availableMonths.length} meses
          </div>
        )}

        <div className="flex items-center gap-2">
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium transition-colors"
          >
            <Printer className="w-4 h-4" />
            Imprimir
          </button>
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-colors"
          >
            <Download className="w-4 h-4" />
            Exportar CSV
          </button>
        </div>
      </div>

      {/* Libro Legal - Formato Oficial */}
      <div ref={libroRef} className="bg-white shadow-lg border border-gray-300 print:shadow-none print:border-none overflow-hidden">
        {/* Cabecera del Libro */}
        <div className="p-8 border-b-2 border-gray-800 print:p-4">
          <div className="text-center mb-6">
            <h1 className="text-xl font-bold text-gray-900 uppercase tracking-wide">
              {currentTaxpayer?.nombre || 'NOMBRE DEL CONTRIBUYENTE'}
            </h1>
            <h2 className="text-lg font-bold text-gray-900 mt-2">
              {config.titulo}
            </h2>
          </div>
          
          <div className="flex justify-between items-start">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-gray-700">ESTABLECIMIENTO:</span>
                <span className="text-gray-900">{sucursalLabel || currentTaxpayer?.nombreComercial || ''}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-gray-700">MES:</span>
                <span className="text-gray-900 uppercase">
                  {displayMonth ? getNombreMes(displayMonth) : ''}
                </span>
                <span className="text-gray-900 mx-2">AÑO:</span>
                <span className="text-gray-900">
                  {displayMonth ? getAnio(displayMonth) : ''}
                </span>
              </div>
            </div>
            <div className="space-y-1 text-right">
              <div className="flex items-center gap-2 justify-end">
                <span className="font-semibold text-gray-700">NIT:</span>
                <span className="text-gray-900">{currentTaxpayer?.nit || ''}</span>
              </div>
              <div className="flex items-center gap-2 justify-end">
                <span className="font-semibold text-gray-700">NRC:</span>
                <span className="text-gray-900">{currentTaxpayer?.nrc || ''}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Tabla del Libro */}
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-gray-100 border-b border-gray-800">
                {config.columnas.map((col, idx) => (
                  <th
                    key={idx}
                    className={`px-2 py-3 font-bold border-r border-gray-300 ${col.width || ''} ${
                      col.align === 'center' ? 'text-center' : col.align === 'right' ? 'text-right' : 'text-left'
                    } ${col.class || ''}`}
                  >
                    {col.header.split('\n').map((line, i) => (
                      <React.Fragment key={i}>
                        {i > 0 && <br />}
                        {line}
                      </React.Fragment>
                    ))}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((item, rowIdx) => (
                <tr key={rowIdx} className="border-b border-gray-200 hover:bg-gray-50">
                  {config.columnas.map((col, colIdx) => (
                    <td
                      key={colIdx}
                      className={`px-2 py-2 border-r border-gray-200 ${
                        col.align === 'center' ? 'text-center' : col.align === 'right' ? 'text-right' : ''
                      } ${col.format === 'moneda' && Number(config.getValor(item, col.key) || 0) > 0 ? 'font-semibold' : ''} ${col.class || ''}`}
                    >
                      {renderCelda(config.getValor(item, col.key), col.format, item, col.key)}
                    </td>
                  ))}
                </tr>
              ))}
              {/* Fila de Totales */}
              <tr className="bg-gray-100 border-t-2 border-gray-800 font-bold">
                {config.columnas.map((col, idx) => {
                  const total = totales[col.key];
                  return (
                    <td
                      key={idx}
                      className={`px-2 py-3 border-r border-gray-300 ${
                        col.align === 'center' ? 'text-center' : col.align === 'right' ? 'text-right' : ''
                      }`}
                    >
                      {idx === 5 ? 'TOTALES' : total !== undefined ? total.toFixed(2) : ''}
                    </td>
                  );
                })}
              </tr>
            </tbody>
          </table>
        </div>

        {/* Resumen de operaciones (solo si hay filas) */}
        {resumenFilas.length > 0 && (
          <div className="p-6 border-t border-gray-300">
            <div className="text-center mb-4">
              <h3 className="font-bold text-sm">{config.resumenTitulo || 'RESUMEN DE OPERACIONES'}</h3>
            </div>
            <table className="w-full text-xs resumen-table">
              <thead>
                <tr className="bg-gray-100">
                  {config.resumenColumnas ? (
                    config.resumenColumnas.map((col, idx) => (
                      <th 
                        key={idx} 
                        className={`px-2 py-2 border border-gray-300 ${col.width || ''} ${
                          col.align === 'center' ? 'text-center' : col.align === 'right' ? 'text-right' : 'text-left'
                        }`}
                      >
                        {col.header}
                      </th>
                    ))
                  ) : (
                    <>
                      <th className="text-left px-2 py-2 border border-gray-300">Descripción</th>
                      <th className="text-right px-2 py-2 border border-gray-300 w-28">VALOR NETO</th>
                      <th className="text-right px-2 py-2 border border-gray-300 w-28">DEBITO FISCAL</th>
                      <th className="text-right px-2 py-2 border border-gray-300 w-28">IVA RETENIDO</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {resumenFilas.map((fila: any, idx: number) => (
                  <tr key={idx} className="border-b border-gray-200">
                    {config.resumenColumnas ? (
                      config.resumenColumnas.map((col, colIdx) => (
                        <td 
                          key={colIdx} 
                          className={`px-2 py-2 border border-gray-300 ${
                            col.align === 'center' ? 'text-center' : col.align === 'right' ? 'text-right' : 'text-left'
                          } ${colIdx === 0 ? 'font-semibold' : ''}`}
                        >
                          {renderCelda(fila[col.key], col.format)}
                        </td>
                      ))
                    ) : (
                      <>
                        <td className="px-2 py-2 border border-gray-300 font-semibold">{fila.label}</td>
                        <td className="px-2 py-2 text-right border border-gray-300">{typeof fila.valorNeto === 'number' ? fila.valorNeto.toFixed(2) : ''}</td>
                        <td className="px-2 py-2 text-right border border-gray-300">{typeof fila.debitoFiscal === 'number' ? fila.debitoFiscal.toFixed(2) : ''}</td>
                        <td className="px-2 py-2 text-right border border-gray-300">{typeof fila.ivaRetenido === 'number' ? (fila.ivaRetenido.toFixed(2)) : '0.00'}</td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pie del reporte con firmas - solo al final */}
        <div className="p-8 border-t border-gray-800 print:mt-8">
          <div className="flex justify-between items-start gap-8">
            {/* Firma izquierda - Contribuyente */}
            <div className="flex-1 text-center">
              <div className="border-b border-gray-800 w-full h-16 mb-2"></div>
              <p className="text-sm font-semibold text-gray-900">
                Nombre Contador o Contribuyente
              </p>
            </div>
            
            {/* Espacio en medio */}
            <div className="w-16"></div>
            
            {/* Firma derecha - Contador */}
            <div className="flex-1 text-center">
              <div className="border-b border-gray-800 w-full h-16 mb-2"></div>
              <p className="text-sm font-semibold text-gray-900">
                Firma Contador o Contribuyente
              </p>
            </div>
          </div>
        </div>

        {/* Pie de página técnico */}
        <div className="p-4 border-t border-gray-300 text-center text-xs text-gray-500">
          <p>Documento generado por DTE Pro - {new Date().toLocaleDateString('es-SV')}</p>
        </div>
      </div>
    </div>
  );
};

export default LibroLegalViewer;
export type { TipoLibro };

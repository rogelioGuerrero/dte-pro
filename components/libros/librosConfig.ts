export interface LibroConfig {
  tipo: string;
  nombre: string;
  descripcion: string;
  campos: CampoConfig[];
}

export interface CampoConfig {
  nombre: string;
  etiqueta: string;
  tipo: 'texto' | 'numero' | 'fecha' | 'select';
  requerido: boolean;
  longitud?: number;
  decimales?: number;
  opciones?: string[];
}

export type TipoLibro = 'compras' | 'contribuyentes' | 'consumidor';

export interface ColumnaConfig {
  key: string;
  header: string;
  width?: string;
  align?: 'left' | 'center' | 'right';
  format?: 'moneda' | 'codigo';
  class?: string;
}

export interface ResumenColumn {
  key: string;
  header: string;
  width?: string;
  align?: 'left' | 'right' | 'center';
  format?: 'moneda';
}

export interface LibroLegalConfig {
  titulo: string;
  columnas: ColumnaConfig[];
  resumenTitulo?: string; // Título opcional para la sección de resumen
  resumenColumnas?: ResumenColumn[]; // Configuración de columnas para el resumen
  getResumen?: (items: any[]) => any[];
  getValor: (item: any, key: string) => any;
  calcularTotales: (items: any[]) => Record<string, number>;
  generarCSV: (items: any[], totales: Record<string, number>, resumenFilas?: any[]) => string;
  nombreArchivo: string;
}

export const LIBROS_CONFIG: LibroConfig[] = [
  {
    tipo: 'C',
    nombre: 'Libro de Compras',
    descripcion: 'Registro de compras y servicios recibidos',
    campos: [
      { nombre: 'docTipo', etiqueta: 'Tipo Documento', tipo: 'select', requerido: true, opciones: ['DTE', 'DOC'] },
      { nombre: 'docNumero', etiqueta: 'Número Documento', tipo: 'texto', requerido: true, longitud: 20 },
      { nombre: 'fecha', etiqueta: 'Fecha', tipo: 'fecha', requerido: true },
      { nombre: 'nit', etiqueta: 'NIT', tipo: 'texto', requerido: true, longitud: 17 },
      { nombre: 'nombre', etiqueta: 'Nombre', tipo: 'texto', requerido: true, longitud: 200 },
      { nombre: 'exento', etiqueta: 'Exento', tipo: 'numero', requerido: false, decimales: 2 },
      { nombre: 'noSujeto', etiqueta: 'No Sujeto', tipo: 'numero', requerido: false, decimales: 2 },
      { nombre: 'gravado', etiqueta: 'Gravado', tipo: 'numero', requerido: true, decimales: 2 },
      { nombre: 'iva', etiqueta: 'IVA', tipo: 'numero', requerido: true, decimales: 2 },
      { nombre: 'total', etiqueta: 'Total', tipo: 'numero', requerido: true, decimales: 2 }
    ]
  },
  {
    tipo: 'V',
    nombre: 'Libro de Ventas',
    descripcion: 'Registro de ventas y servicios prestados',
    campos: [
      { nombre: 'docTipo', etiqueta: 'Tipo Documento', tipo: 'select', requerido: true, opciones: ['DTE', 'DOC'] },
      { nombre: 'docNumero', etiqueta: 'Número Documento', tipo: 'texto', requerido: true, longitud: 20 },
      { nombre: 'fecha', etiqueta: 'Fecha', tipo: 'fecha', requerido: true },
      { nombre: 'nit', etiqueta: 'NIT', tipo: 'texto', requerido: true, longitud: 17 },
      { nombre: 'nombre', etiqueta: 'Nombre', tipo: 'texto', requerido: true, longitud: 200 },
      { nombre: 'exento', etiqueta: 'Exento', tipo: 'numero', requerido: false, decimales: 2 },
      { nombre: 'noSujeto', etiqueta: 'No Sujeto', tipo: 'numero', requerido: false, decimales: 2 },
      { nombre: 'gravado', etiqueta: 'Gravado', tipo: 'numero', requerido: true, decimales: 2 },
      { nombre: 'iva', etiqueta: 'IVA', tipo: 'numero', requerido: true, decimales: 2 },
      { nombre: 'total', etiqueta: 'Total', tipo: 'numero', requerido: true, decimales: 2 }
    ]
  },
  {
    tipo: 'R',
    nombre: 'Libro de Remesas',
    descripcion: 'Registro de remesas y envíos',
    campos: [
      { nombre: 'docTipo', etiqueta: 'Tipo Documento', tipo: 'select', requerido: true, opciones: ['DTE', 'DOC'] },
      { nombre: 'docNumero', etiqueta: 'Número Documento', tipo: 'texto', requerido: true, longitud: 20 },
      { nombre: 'fecha', etiqueta: 'Fecha', tipo: 'fecha', requerido: true },
      { nombre: 'nit', etiqueta: 'NIT', tipo: 'texto', requerido: true, longitud: 17 },
      { nombre: 'nombre', etiqueta: 'Nombre', tipo: 'texto', requerido: true, longitud: 200 },
      { nombre: 'total', etiqueta: 'Total', tipo: 'numero', requerido: true, decimales: 2 }
    ]
  },
  {
    tipo: 'I',
    nombre: 'Libro de Ingresos',
    descripcion: 'Registro de ingresos y percepciones',
    campos: [
      { nombre: 'docTipo', etiqueta: 'Tipo Documento', tipo: 'select', requerido: true, opciones: ['DTE', 'DOC'] },
      { nombre: 'docNumero', etiqueta: 'Número Documento', tipo: 'texto', requerido: true, longitud: 20 },
      { nombre: 'fecha', etiqueta: 'Fecha', tipo: 'fecha', requerido: true },
      { nombre: 'nit', etiqueta: 'NIT', tipo: 'texto', requerido: true, longitud: 17 },
      { nombre: 'nombre', etiqueta: 'Nombre', tipo: 'texto', requerido: true, longitud: 200 },
      { nombre: 'gravado', etiqueta: 'Gravado', tipo: 'numero', requerido: true, decimales: 2 },
      { nombre: 'iva', etiqueta: 'IVA', tipo: 'numero', requerido: true, decimales: 2 },
      { nombre: 'total', etiqueta: 'Total', tipo: 'numero', requerido: true, decimales: 2 }
    ]
  }
];

export function getLibroConfig(tipo: string): LibroConfig | undefined {
  return LIBROS_CONFIG.find(config => config.tipo === tipo);
}

export function getTiposLibros(): { tipo: string; nombre: string }[] {
  return LIBROS_CONFIG.map(config => ({
    tipo: config.tipo,
    nombre: config.nombre
  }));
}

export function formatMoneda(valor: any): string {
  if (typeof valor === 'number') {
    return valor.toFixed(2);
  }
  return '0.00';
}

export function getConfigLibro(tipoLibro: TipoLibro): LibroLegalConfig | null {
  switch (tipoLibro) {
    case 'compras':
      return {
        titulo: 'LIBRO DE COMPRAS',
        columnas: [
          { key: 'correlativo', header: 'CORRELATIVO', width: 'w-16', align: 'center' },
          { key: 'fecha', header: 'FECHA', width: 'w-20', align: 'center' },
          { key: 'codigoGeneracion', header: 'CÓDIGO\nGENERACIÓN', width: 'w-32', align: 'center', format: 'codigo' },
          { key: 'nrc', header: 'NRC', width: 'w-20', align: 'center' },
          { key: 'nitSujetoExcluido', header: 'NIT\nSUJETO\nEXCLUIDO', width: 'w-24', align: 'center' },
          { key: 'nombreProveedor', header: 'NOMBRE PROVEEDOR', width: 'w-48', align: 'left' },
          { key: 'comprasExentas', header: 'COMPRAS\nEXENTAS', width: 'w-24', align: 'right', format: 'moneda' },
          { key: 'comprasGravadasLocales', header: 'COMPRAS\nGRAVADAS\nLOCALES', width: 'w-28', align: 'right', format: 'moneda' },
          { key: 'creditoFiscal', header: 'CRÉDITO\nFISCAL', width: 'w-20', align: 'right', format: 'moneda' },
          { key: 'totalCompras', header: 'TOTAL\nCOMPRAS', width: 'w-20', align: 'right', format: 'moneda' },
          { key: 'retencionTerceros', header: 'RETENCIÓN\nDE\nTERCEROS', width: 'w-24', align: 'right', format: 'moneda' },
          { key: 'comprasSujetoExcluido', header: 'COMPRAS\nSUJETO\nEXCLUIDO', width: 'w-28', align: 'right', format: 'moneda' }
        ],
        getValor: (item, key) => item[key] || '',
        
        calcularTotales: (items) => {
          const totales = {
            comprasExentas: 0,
            comprasGravadasLocales: 0,
            creditoFiscal: 0,
            totalCompras: 0,
            retencionTerceros: 0,
            comprasSujetoExcluido: 0
          };
          
          items.forEach(item => {
            totales.comprasExentas += item.comprasExentas || 0;
            totales.comprasGravadasLocales += item.comprasGravadasLocales || 0;
            totales.creditoFiscal += item.creditoFiscal || 0;
            totales.totalCompras += item.totalCompras || 0;
            totales.retencionTerceros += item.retencionTerceros || 0;
            totales.comprasSujetoExcluido += item.comprasSujetoExcluido || 0;
          });
          
          return totales;
        },
        generarCSV: (items, totales) => {
          let csv = 'No Corr;Fecha;Codigo de Generacion;NRC;Nit Sujeto Excluido;Nombre del Proveedor;Compras exentas;Compras Gravadas Locales;Credito Fiscal;Total Compras;Retencion a Terceros;Compras a Sujeto Excluido\n';
          
          items.forEach(item => {
            // Usar valores absolutos para CSV (siempre positivos)
            csv += `${item.correlativo};${item.fecha};${item.codigoGeneracion};${item.nrc};${item.nitSujetoExcluido};${item.nombreProveedor};${Math.abs(item.comprasExentas || 0).toFixed(2)};${Math.abs(item.comprasGravadasLocales || 0).toFixed(2)};${Math.abs(item.creditoFiscal || 0).toFixed(2)};${Math.abs(item.totalCompras || 0).toFixed(2)};${Math.abs(item.retencionTerceros || 0).toFixed(2)};${Math.abs(item.comprasSujetoExcluido || 0).toFixed(2)}\n`;
          });

          csv += `;;;;;TOTALES;${Math.abs(totales.comprasExentas).toFixed(2)};${Math.abs(totales.comprasGravadasLocales).toFixed(2)};${Math.abs(totales.creditoFiscal).toFixed(2)};${Math.abs(totales.totalCompras).toFixed(2)};;\n`;
          
          return csv;
        },
        nombreArchivo: 'LIBRO_COMPRAS'
      };
    
    case 'contribuyentes':
      return {
        titulo: 'LIBRO DE VENTAS A CONTRIBUYENTES',
        columnas: [
          { key: 'correlativo', header: 'CORRELATIVO', width: 'w-10', align: 'center', class: 'font-mono text-[10px]' },
          { key: 'fecha', header: 'FECHA', width: 'w-16', align: 'center', class: 'font-mono text-[10px]' },
          { key: 'codigoGeneracion', header: 'CÓDIGO GENERACIÓN', width: 'w-32', align: 'center', format: 'codigo', class: 'font-mono text-[10px]' },
          { key: 'formUnico', header: 'FORM ÚNICO', width: 'w-6', align: 'center', class: 'font-mono text-[10px]' },
          { key: 'cliente', header: 'CLIENTE', width: 'w-72', align: 'left' },
          { key: 'nrc', header: 'NRC', width: 'w-12', align: 'center', class: 'font-mono text-[10px]' },
          { key: 'ventasExentas', header: 'VENTAS EXENTAS', width: 'w-16', align: 'right', format: 'moneda', class: 'font-mono text-[10px]' },
          { key: 'exportaciones', header: 'EXPORTACIONES', width: 'w-16', align: 'right', format: 'moneda', class: 'font-mono text-[10px]' },
          { key: 'ventasGravadas', header: 'VENTAS GRAVADAS', width: 'w-14', align: 'right', format: 'moneda', class: 'font-mono text-[10px]' },
          { key: 'debitoFiscal', header: 'DÉBITO FISCAL', width: 'w-14', align: 'right', format: 'moneda', class: 'font-mono text-[10px]' },
          { key: 'ventaCuentaTerceros', header: 'VENTA CUENTA\nDE TERCEROS', width: 'w-24', align: 'right', format: 'moneda', class: 'font-mono text-[10px]' },
          { key: 'debitoFiscalTerceros', header: 'DÉBITO FISCAL\nDE TERCEROS', width: 'w-28', align: 'right', format: 'moneda', class: 'font-mono text-[10px]' },
          { key: 'impuestoPercibido', header: 'IMPUESTO PERCIBIDO', width: 'w-16', align: 'right', format: 'moneda', class: 'font-mono text-[10px]' },
          { key: 'ventasTotales', header: 'VENTAS TOTALES', width: 'w-16', align: 'right', format: 'moneda', class: 'font-mono text-[10px]' }
        ],
        resumenTitulo: 'RESUMEN DE OPERACIONES',
        resumenColumnas: [
          { key: 'label', header: 'Descripción', align: 'left' },
          { key: 'valorNeto', header: 'VALOR NETO', width: 'w-28', align: 'right', format: 'moneda' },
          { key: 'debitoFiscal', header: 'DEBITO FISCAL', width: 'w-28', align: 'right', format: 'moneda' },
          { key: 'ivaRetenido', header: 'IVA RETENIDO', width: 'w-28', align: 'right', format: 'moneda' }
        ],
        getResumen: (items) => {
          // Totales calculados
          const totalGravadasContribuyentes = items.reduce((sum, item) => sum + (item.ventasGravadas || 0), 0);
          const totalExentasContribuyentes = items.reduce((sum, item) => sum + (item.ventasExentas || 0), 0);
          const totalExportaciones = items.reduce((sum, item) => sum + (item.exportaciones || 0), 0);
          const totalDebitoFiscal = items.reduce((sum, item) => sum + (item.debitoFiscal || 0), 0);
          
          // Calcular descuentos totales para obtener ventas NETAS gravadas
          const totalVentasTotales = items.reduce((sum, item) => sum + (item.ventasTotales || 0), 0);
          const totalDescuentos = totalGravadasContribuyentes - (totalVentasTotales - totalDebitoFiscal);
          const ventasNetasGravadasContribuyentes = totalGravadasContribuyentes - totalDescuentos;
          
          // Verificar débito fiscal (debe ser 13% de ventas netas)
          const debitoFiscalCalculado = ventasNetasGravadasContribuyentes * 0.13;
          
          // Asumimos 0 para consumidores si este libro es solo contribuyentes
          const totalGravadasConsumidores = 0;
          const totalExentasConsumidores = 0;

          return [
            { 
              label: 'VENTAS NETAS INTERNAS GRAVADAS A CONTRIBUYENTES', 
              valorNeto: ventasNetasGravadasContribuyentes, 
              debitoFiscal: debitoFiscalCalculado, 
              ivaRetenido: 0 
            },
            { 
              label: 'VENTAS NETAS INTERNAS GRAVADAS A CONSUMIDORES', 
              valorNeto: totalGravadasConsumidores, 
              debitoFiscal: 0, 
              ivaRetenido: 0 
            },
            { 
              label: 'TOTAL OPERACIONES INTERNADAS GRAVADAS', 
              valorNeto: ventasNetasGravadasContribuyentes + totalGravadasConsumidores, 
              debitoFiscal: debitoFiscalCalculado, 
              ivaRetenido: 0 
            },
            { 
              label: 'VENTAS NETAS INTERNAS EXENTAS A CONTRIBUYENTES', 
              valorNeto: totalExentasContribuyentes, 
              debitoFiscal: 0, 
              ivaRetenido: 0 
            },
            { 
              label: 'VENTAS NETAS INTERNAS EXENTAS A CONSUMIDORES', 
              valorNeto: totalExentasConsumidores, 
              debitoFiscal: 0, 
              ivaRetenido: 0 
            },
            { 
              label: 'TOTAL OPERACIONES INTERNADAS EXENTAS', 
              valorNeto: totalExentasContribuyentes + totalExentasConsumidores, 
              debitoFiscal: 0, 
              ivaRetenido: 0 
            },
            { 
              label: 'EXPORTACIONES SEGÚN FATURAS DE EXPORTACION', 
              valorNeto: totalExportaciones, 
              debitoFiscal: 0, 
              ivaRetenido: 0 
            }
          ];
        },
        getValor: (item, key) => {
          return item[key] || '';
        },
        calcularTotales: (items) => {
          const totales: Record<string, number> = {
            ventasExentas: 0,
            ventasNoSujetas: 0,
            ventasGravadas: 0,
            debitoFiscal: 0,
            ventaCuentaTerceros: 0,
            debitoFiscalTerceros: 0,
            impuestoPercibido: 0,
            ventasTotales: 0
          };
          
          items.forEach(item => {
            totales.ventasExentas += item.ventasExentas || 0;
            totales.ventasNoSujetas += item.ventasNoSujetas || 0;
            totales.ventasGravadas += item.ventasGravadas || 0;
            totales.debitoFiscal += item.debitoFiscal || 0;
            totales.ventaCuentaTerceros += item.ventaCuentaTerceros || 0;
            totales.debitoFiscalTerceros += item.debitoFiscalTerceros || 0;
            totales.impuestoPercibido += item.impuestoPercibido || 0;
            totales.ventasTotales += item.ventasTotales || 0;
          });
          
          return totales;
        },
        generarCSV: (items, _totales) => {
          let csv = '';
          
          items.forEach(item => {
            // Formatear fecha: DD/MM/YYYY (con ceros)
            const fechaParts = item.fecha.split('/');
            const dia = parseInt(fechaParts[0], 10).toString().padStart(2, '0');
            const mes = parseInt(fechaParts[1], 10).toString().padStart(2, '0');
            const anio = fechaParts[2];
            const fechaFormateada = `${dia}/${mes}/${anio}`;
            
            // Extraer información del número de control
            const numeroControl = item.numeroControlDel || '';
            const numeroControlSinGuiones = numeroControl.replace(/-/g, '');
            const codigoGeneracion = item.codigoGeneracion || '';
            const codigoGeneracionSinGuiones = codigoGeneracion.replace(/-/g, '');
            
            // Para DTEs de contribuyentes - determinar tipo de documento
            const claseDocumento = '4'; // DTE
            let tipoDocumento = '03'; // Default: CCF para contribuyentes
            
            // Ajustar tipo de documento según tipoDTE
            if (item.tipoDTE === '05') {
              tipoDocumento = '05'; // Nota de Crédito
            } else if (item.tipoDTE === '06') {
              tipoDocumento = '06'; // Nota de Débito
            }
            
            // Valores fijos según normativa DGII para servicios profesionales
            const tipoOperacionRenta = '1'; // 1 = Gravada
            const tipoIngresoRenta = '2'; // 2 = Arrendamiento (para servicios de arrendamiento)
            // Número de anexo siempre es 1 para contribuyentes
            
            // Usar valores absolutos para CSV (siempre positivos)
            csv += `${fechaFormateada};${claseDocumento};${tipoDocumento};${numeroControlSinGuiones};${item.selloRecibido || ''};${codigoGeneracionSinGuiones};;${item.nrc || ''};${item.cliente || ''};${Math.abs(item.ventasExentas || 0).toFixed(2)};${Math.abs(item.ventasNoSujetas || 0).toFixed(2)};${Math.abs(item.ventasGravadas || 0).toFixed(2)};${Math.abs(item.debitoFiscal || 0).toFixed(2)};${Math.abs(item.ventaCuentaTerceros || 0).toFixed(2)};${Math.abs(item.debitoFiscalTerceros || 0).toFixed(2)};${Math.abs(item.ventasTotales || 0).toFixed(2)};${item.dui || ''};${tipoOperacionRenta};${tipoIngresoRenta};1\n`;
          });
          
          return csv;
        },
        nombreArchivo: 'LIBRO_VENTAS_CONTRIBUYENTES'
      };
    
    case 'consumidor':
      return {
        titulo: 'LIBRO DE OPERACIONES DE VENTA A CONSUMIDOR FINAL',
        columnas: [
          { key: 'fecha', header: 'DÍA', width: 'w-12', align: 'center' },
          { key: 'codigoGeneracionInicial', header: 'CÓDIGO\nGENERACIÓN\nINICIAL', width: 'w-32', align: 'center', format: 'codigo' },
          { key: 'codigoGeneracionFinal', header: 'CÓDIGO\nGENERACIÓN\nFINAL', width: 'w-32', align: 'center', format: 'codigo' },
          { key: 'numeroControlDel', header: 'NÚMERO\nCONTROL\nDEL', width: 'w-24', align: 'center', format: 'codigo' },
          { key: 'numeroControlAl', header: 'NÚMERO\nCONTROL\nAL', width: 'w-24', align: 'center', format: 'codigo' },
          { key: 'ventasExentas', header: 'VENTAS\nEXENTAS', width: 'w-20', align: 'right', format: 'moneda' },
          { key: 'ventasGravadas', header: 'VENTAS\nGRAVADAS', width: 'w-20', align: 'right', format: 'moneda' },
          { key: 'exportaciones', header: 'EXPORTACIONES', width: 'w-24', align: 'right', format: 'moneda' },
          { key: 'ventaTotal', header: 'VENTA\nTOTAL', width: 'w-20', align: 'right', format: 'moneda' }
        ],
        resumenTitulo: 'CALCULO DEL DEBITO FISCAL POR OPERACIONES PROPIAS',
        resumenColumnas: [
           { key: 'label', header: '', align: 'left' },
           { key: 'valor', header: '', width: 'w-32', align: 'right', format: 'moneda' }
        ],
        getResumen: (items) => {
          // Para consumidor final, usar ventaTotal como base para el cálculo
          // ya que incluye el IVA (13%)
          const totalVentasGravadas = items.reduce((sum, item) => sum + (item.ventaTotal || 0), 0);
          
          // Cálculo inverso: En consumidor final, el monto incluye IVA.
          // Base = Total / 1.13
          // IVA = Total - Base
          const ventasNetas = totalVentasGravadas / 1.13;
          const impuesto = totalVentasGravadas - ventasNetas;
          
          return [
            { label: 'VENTAS INTERNAS GRAVADAS NETAS', valor: ventasNetas },
            { label: '13% IMPUESTO', valor: impuesto },
            { label: 'TOTAL VENTAS GRAVADAS', valor: totalVentasGravadas }
          ];
        },
        getValor: (item, key) => item[key] || '',
        
        calcularTotales: (items) => {
          const totales = {
            ventasExentas: 0,
            ventasInternasExentas: 0,
            ventasNoSujetas: 0,
            ventasGravadas: 0,
            exportacionesCentroAmerica: 0,
            exportacionesFueraCentroAmerica: 0,
            exportacionesServicios: 0,
            ventasZonasFrancas: 0,
            ventasCuentaTerceros: 0,
            ventaTotal: 0,
          };
          
          items.forEach(item => {
            totales.ventasExentas += item.ventasExentas || 0;
            totales.ventasInternasExentas += item.ventasInternasExentas || 0;
            totales.ventasNoSujetas += item.ventasNoSujetas || 0;
            totales.ventasGravadas += item.ventasGravadas || 0;
            totales.exportacionesCentroAmerica += item.exportacionesCentroAmerica || 0;
            totales.exportacionesFueraCentroAmerica += item.exportacionesFueraCentroAmerica || 0;
            totales.exportacionesServicios += item.exportacionesServicios || 0;
            totales.ventasZonasFrancas += item.ventasZonasFrancas || 0;
            totales.ventasCuentaTerceros += item.ventasCuentaTerceros || 0;
            totales.ventaTotal += item.ventaTotal || 0;
          });
          
          return totales;
        },
        generarCSV: (items, _totales) => {
          let csv = '';
          
          items.forEach(item => {
            // Formatear fecha: DD/MM/YYYY (con ceros)
            const fechaParts = item.fecha.split('/');
            const dia = parseInt(fechaParts[0], 10).toString().padStart(2, '0');
            const mes = parseInt(fechaParts[1], 10).toString().padStart(2, '0');
            const anio = fechaParts[2];
            const fechaFormateada = `${dia}/${mes}/${anio}`;
            
            // Extraer información del número de control
            const numeroControl = item.numeroControlDel || '';
            const numeroControlSinGuiones = numeroControl.replace(/-/g, '');
            const codigoGeneracion = item.codigoGeneracionInicial || '';
            const codigoGeneracionSinGuiones = codigoGeneracion.replace(/-/g, '');
            
            // Para DTEs de consumidor final - determinar tipo de documento
            const claseDocumento = '4'; // DTE
            let tipoDocumento = '01'; // Default: Factura consumidor final
            
            // Ajustar tipo de documento según tipoDTE
            if (item.tipoDTE === '05') {
              tipoDocumento = '05'; // Nota de Crédito
            } else if (item.tipoDTE === '06') {
              tipoDocumento = '06'; // Nota de Débito
            }
            
            // Valores fijos según normativa DGII para consumidor final
            const tipoOperacionRenta = '1'; // 1 = Gravada
            const tipoIngresoRenta = '1'; // 1 = Profesiones, Artes y Oficios
            const numeroAnexo = '2'; // Anexo 2 para consumidor final
            
            // Para DTEs individuales, los valores DEL y AL son los mismos
            // Usar valores absolutos para CSV (siempre positivos)
            csv += `${fechaFormateada};${claseDocumento};${tipoDocumento};${numeroControlSinGuiones};${item.selloRecibido || ''};${codigoGeneracionSinGuiones};${codigoGeneracionSinGuiones};${codigoGeneracionSinGuiones};${codigoGeneracionSinGuiones};;${Math.abs(item.ventasExentas || 0).toFixed(2)};${Math.abs(item.ventasInternasExentas || 0).toFixed(2)};${Math.abs(item.ventasNoSujetas || 0).toFixed(2)};${Math.abs(item.ventasGravadas || 0).toFixed(2)};${Math.abs(item.exportacionesCentroAmerica || 0).toFixed(2)};${Math.abs(item.exportacionesFueraCentroAmerica || 0).toFixed(2)};${Math.abs(item.exportacionesServicios || 0).toFixed(2)};${Math.abs(item.ventasZonasFrancas || 0).toFixed(2)};${Math.abs(item.ventasCuentaTerceros || 0).toFixed(2)};${Math.abs(item.ventaTotal || 0).toFixed(2)};${tipoOperacionRenta};${tipoIngresoRenta};${numeroAnexo}\n`;
          });
          
          return csv;
        },
        nombreArchivo: 'LIBRO_CONSUMIDOR_FINAL'
      };
    
    default:
      return null;
  }
}

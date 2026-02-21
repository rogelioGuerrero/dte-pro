// Catálogos específicos para Factura de Exportación (FEXE)
// Basado en especificación oficial del Ministerio de Hacienda

import { CatalogoItem, CatalogoItemNum } from './documentos';

// CAT-020: Países (códigos oficiales MH)
export const paises: CatalogoItem[] = [
  { codigo: '0001', descripcion: 'El Salvador' },
  { codigo: '0508', descripcion: 'Guatemala' },
  { codigo: '0509', descripcion: 'Honduras' },
  { codigo: '0510', descripcion: 'Nicaragua' },
  { codigo: '0511', descripcion: 'Costa Rica' },
  { codigo: '0512', descripcion: 'Panamá' },
  { codigo: '1220', descripcion: 'México' },
  { codigo: '1221', descripcion: 'Estados Unidos' },
  { codigo: '1222', descripcion: 'Canadá' },
  { codigo: '2301', descripcion: 'Colombia' },
  { codigo: '2302', descripcion: 'Venezuela' },
  { codigo: '2303', descripcion: 'Ecuador' },
  { codigo: '2304', descripcion: 'Perú' },
  { codigo: '2305', descripcion: 'Chile' },
  { codigo: '2306', descripcion: 'Argentina' },
  { codigo: '2307', descripcion: 'Brasil' },
  { codigo: '3201', descripcion: 'España' },
  { codigo: '3202', descripcion: 'Francia' },
  { codigo: '3203', descripcion: 'Italia' },
  { codigo: '3204', descripcion: 'Alemania' },
  { codigo: '3205', descripcion: 'Reino Unido' },
];

// CAT-031: INCOTERMS (Términos de Comercio Internacional)
export const incoterms: CatalogoItem[] = [
  { codigo: 'EXW', descripcion: 'EXW - En fábrica' },
  { codigo: 'FCA', descripcion: 'FCA - Franco transportista' },
  { codigo: 'FAS', descripcion: 'FAS - Franco al costado del buque' },
  { codigo: 'FOB', descripcion: 'FOB - Franco a bordo' },
  { codigo: 'CFR', descripcion: 'CFR - Costo y flete' },
  { codigo: 'CIF', descripcion: 'CIF - Costo, seguro y flete' },
  { codigo: 'CPT', descripcion: 'CPT - Transporte pagado hasta' },
  { codigo: 'CIP', descripcion: 'CIP - Transporte y seguro pagados hasta' },
  { codigo: 'DAT', descripcion: 'DAT - Entregado en terminal' },
  { codigo: 'DAP', descripcion: 'DAP - Entregado en un punto' },
  { codigo: 'DDP', descripcion: 'DDP - Entregado derechos pagados' },
];

// CAT-030: Modos de Transporte
export const modosTransporte: CatalogoItemNum[] = [
  { codigo: 1, descripcion: 'Marítimo' },
  { codigo: 2, descripcion: 'Aéreo' },
  { codigo: 3, descripcion: 'Terrestre' },
  { codigo: 4, descripcion: 'Ferroviario' },
  { codigo: 5, descripcion: 'Fluvial' },
];

// CAT-025: Tipo de Exportación
export const tiposExportacion: CatalogoItemNum[] = [
  { codigo: 1, descripcion: 'Exportación Definitiva' },
  { codigo: 2, descripcion: 'Exportación Temporal' },
  { codigo: 3, descripcion: 'Reexportación' },
];

// Regímenes aduaneros
export const regimenesAduaneros: CatalogoItem[] = [
  { codigo: '10', descripcion: 'Exportación Definitiva' },
  { codigo: '50', descripcion: 'Exportación Temporal' },
  { codigo: '31', descripcion: 'Reexportación' },
  { codigo: '40', descripcion: 'Reimportación' },
];

// Obtener país por código
export const getPaisPorCodigo = (codigo: string): CatalogoItem | undefined => {
  return paises.find(p => p.codigo === codigo);
};

// Obtener incoterm por código
export const getIncotermPorCodigo = (codigo: string): CatalogoItem | undefined => {
  return incoterms.find(i => i.codigo === codigo);
};

// Obtener modo de transporte por código
export const getModoTransportePorCodigo = (codigo: number): CatalogoItemNum | undefined => {
  return modosTransporte.find(m => m.codigo === codigo);
};

// Países de Centroamérica (para filtros)
export const paisesCentroamerica = paises.filter(p => 
  ['0001', '0508', '0509', '0510', '0511', '0512'].includes(p.codigo)
);

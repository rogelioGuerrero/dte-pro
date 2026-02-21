// Índice de Catálogos DTE - El Salvador
// Exporta todos los catálogos oficiales del Ministerio de Hacienda

// Tipos base
export type { CatalogoItem, CatalogoItemNum } from './documentos';

// Documentos
export {
  tiposDocumento,
  tiposTransmision,
  tiposModelo,
  tiposEstablecimiento,
  tiposItem,
  condicionesOperacion,
  tiposContingencia,
  tiposDocumentoIdentificacion,
  tiposInvalidacion,
  tiposServicioMedico,
  tiposDocumentoRelacionado,
  estadosDocumento,
  ambientes,
} from './documentos';

// Tributos
export type { Tributo } from './tributos';
export {
  tributos,
  getTributosPorDocumento,
  getTributoPorCodigo,
  tributosRetencion,
  tributosPercepcion,
  IVA_ESTANDAR,
} from './tributos';

// Pagos
export {
  formasPago,
  plazos,
  tiposDescuento,
  monedas,
  getFormaPagoPorCodigo,
  getPlazoPorCodigo,
  formasPagoStripe,
  requiereStripe,
} from './pagos';

// Unidades de Medida
export type { UnidadMedida } from './unidadesMedida';
export {
  unidadesMedida,
} from './unidadesMedida';

// Ubicación (Departamentos y Municipios)
export type { Departamento, Municipio } from './departamentosMunicipios';
export {
  departamentos,
  getMunicipiosByDepartamento,
  getDepartamentoNombre,
  getMunicipioNombre,
  getDepartamentoPorCodigo,
  buscarMunicipios,
} from './departamentosMunicipios';

// Actividades Económicas
export type { ActividadEconomica } from './actividadesEconomicas';
export {
  actividadesEconomicas,
  getActividadPorCodigo,
  buscarActividades,
  actividadesComunes,
} from './actividadesEconomicas';

// Exportación (FEXE)
export {
  paises,
  incoterms,
  modosTransporte,
  tiposExportacion,
  regimenesAduaneros,
  getPaisPorCodigo,
  getIncotermPorCodigo,
  getModoTransportePorCodigo,
  paisesCentroamerica,
} from './exportacion';

// Objeto con todos los catálogos para uso en hook
export const catalogosCompletos = {
  // Documentos
  tiposDocumento: () => import('./documentos').then(m => m.tiposDocumento),
  tiposTransmision: () => import('./documentos').then(m => m.tiposTransmision),
  tiposModelo: () => import('./documentos').then(m => m.tiposModelo),
  tiposEstablecimiento: () => import('./documentos').then(m => m.tiposEstablecimiento),
  tiposItem: () => import('./documentos').then(m => m.tiposItem),
  condicionesOperacion: () => import('./documentos').then(m => m.condicionesOperacion),
  tiposContingencia: () => import('./documentos').then(m => m.tiposContingencia),
  tiposDocumentoIdentificacion: () => import('./documentos').then(m => m.tiposDocumentoIdentificacion),
  tiposInvalidacion: () => import('./documentos').then(m => m.tiposInvalidacion),
  estadosDocumento: () => import('./documentos').then(m => m.estadosDocumento),
  ambientes: () => import('./documentos').then(m => m.ambientes),
  
  // Tributos
  tributos: () => import('./tributos').then(m => m.tributos),
  
  // Pagos
  formasPago: () => import('./pagos').then(m => m.formasPago),
  plazos: () => import('./pagos').then(m => m.plazos),
  
  // Unidades
  unidadesMedida: () => import('./unidadesMedida').then(m => m.unidadesMedida),
  
  // Ubicación
  departamentos: () => import('./departamentosMunicipios').then(m => m.departamentos),
  
  // Actividades
  actividadesEconomicas: () => import('./actividadesEconomicas').then(m => m.actividadesEconomicas),
  
  // Exportación
  paises: () => import('./exportacion').then(m => m.paises),
  incoterms: () => import('./exportacion').then(m => m.incoterms),
  modosTransporte: () => import('./exportacion').then(m => m.modosTransporte),
};

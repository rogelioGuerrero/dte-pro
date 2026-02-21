// Catálogo de Tipos de Documento DTE
// Basado en especificación oficial del Ministerio de Hacienda de El Salvador

export interface CatalogoItem {
  codigo: string;
  descripcion: string;
}

export interface CatalogoItemNum {
  codigo: number;
  descripcion: string;
}

// CAT-002: Tipo de Documento
export const tiposDocumento: CatalogoItem[] = [
  { codigo: '01', descripcion: 'Factura Electrónica (FE)' },
  { codigo: '02', descripcion: 'Factura de Venta Simplificada (FVS)' },
  { codigo: '03', descripcion: 'Comprobante de Crédito Fiscal Electrónico (CCFE)' },
  { codigo: '04', descripcion: 'Nota de Remisión Electrónica (NRE)' },
  { codigo: '05', descripcion: 'Nota de Crédito Electrónica (NCE)' },
  { codigo: '06', descripcion: 'Nota de Débito Electrónica (NDE)' },
  { codigo: '07', descripcion: 'Comprobante de Retención Electrónico (CRE)' },
  { codigo: '08', descripcion: 'Comprobante de Liquidación Electrónico (CLE)' },
  { codigo: '09', descripcion: 'Documento Contable de Liquidación Electrónica (DCLE)' },
  { codigo: '10', descripcion: 'Tiquetes de Máquina Registradora' },
  { codigo: '11', descripcion: 'Factura de Exportación Electrónica (FEXE)' },
  { codigo: '14', descripcion: 'Factura de Sujeto Excluido Electrónica (FSEE)' },
  { codigo: '15', descripcion: 'Comprobante de Donación Electrónico (CDE)' },
];

// CAT-003: Tipo de Transmisión
export const tiposTransmision: CatalogoItemNum[] = [
  { codigo: 1, descripcion: 'Transmisión Normal (Previa)' },
  { codigo: 2, descripcion: 'Transmisión por Contingencia (Diferida)' },
];

// CAT-004: Tipo de Modelo de Facturación
export const tiposModelo: CatalogoItemNum[] = [
  { codigo: 1, descripcion: 'Modelo de Facturación Previo' },
  { codigo: 2, descripcion: 'Modelo de Facturación Diferido' },
];

// CAT-009: Tipo de Establecimiento
export const tiposEstablecimiento: CatalogoItem[] = [
  { codigo: '01', descripcion: 'Casa Matriz' },
  { codigo: '02', descripcion: 'Sucursal/Agencia' },
  { codigo: '03', descripcion: 'Bodega' },
  { codigo: '04', descripcion: 'Patio/Predio' },
  { codigo: '99', descripcion: 'Otro' },
];

// CAT-011: Tipo de Item
export const tiposItem: CatalogoItemNum[] = [
  { codigo: 1, descripcion: 'Bienes' },
  { codigo: 2, descripcion: 'Servicios' },
  { codigo: 3, descripcion: 'Bienes y Servicios (Ambos)' },
  { codigo: 4, descripcion: 'Tributos sujetos a cálculo de IVA' },
];

// CAT-016: Condición de la Operación
export const condicionesOperacion: CatalogoItemNum[] = [
  { codigo: 1, descripcion: 'Contado' },
  { codigo: 2, descripcion: 'Crédito' },
  { codigo: 3, descripcion: 'Otra' },
];

// CAT-005: Tipo de Contingencia
export const tiposContingencia: CatalogoItemNum[] = [
  { codigo: 1, descripcion: 'Corte de energía eléctrica' },
  { codigo: 2, descripcion: 'Falla en el servicio de Internet' },
  { codigo: 3, descripcion: 'Falla en el equipo informático' },
  { codigo: 4, descripcion: 'Falla en el software' },
  { codigo: 5, descripcion: 'Otro motivo' },
];

// CAT-022: Tipo de Documento de Identificación del Receptor
export const tiposDocumentoIdentificacion: CatalogoItem[] = [
  { codigo: '36', descripcion: 'NIT' },
  { codigo: '13', descripcion: 'DUI' },
  { codigo: '14', descripcion: 'Pasaporte' },
  { codigo: '02', descripcion: 'Carnet de Residencia' },
  { codigo: '03', descripcion: 'Documento de Identificación de Extranjero' },
  { codigo: '04', descripcion: 'Documento de Identificación Tributario' },
  { codigo: '99', descripcion: 'Otro' },
];

// CAT-024: Tipo de Invalidación
export const tiposInvalidacion: CatalogoItemNum[] = [
  { codigo: 1, descripcion: 'Error en datos del documento' },
  { codigo: 2, descripcion: 'Rescisión total de la operación' },
  { codigo: 3, descripcion: 'Ajuste a la operación' },
];

// CAT-026: Tipo de Servicio Médico
export const tiposServicioMedico: CatalogoItemNum[] = [
  { codigo: 1, descripcion: 'Consulta' },
  { codigo: 2, descripcion: 'Hospitalización' },
  { codigo: 3, descripcion: 'Medicamentos' },
  { codigo: 4, descripcion: 'Servicios de laboratorio' },
  { codigo: 5, descripcion: 'Servicios de imágenes' },
  { codigo: 6, descripcion: 'Servicios quirúrgicos' },
  { codigo: 7, descripcion: 'Otros' },
];

// CAT-027: Tipo de Documento Relacionado
export const tiposDocumentoRelacionado: CatalogoItem[] = [
  { codigo: '01', descripcion: 'Factura Electrónica' },
  { codigo: '03', descripcion: 'Comprobante de Crédito Fiscal' },
  { codigo: '04', descripcion: 'Nota de Remisión' },
  { codigo: '05', descripcion: 'Nota de Crédito' },
  { codigo: '06', descripcion: 'Nota de Débito' },
  { codigo: '07', descripcion: 'Comprobante de Retención' },
  { codigo: '08', descripcion: 'Comprobante de Liquidación' },
  { codigo: '09', descripcion: 'Documento Contable de Liquidación' },
  { codigo: '11', descripcion: 'Factura de Exportación' },
  { codigo: '14', descripcion: 'Factura de Sujeto Excluido' },
  { codigo: '15', descripcion: 'Comprobante de Donación' },
];

// Estados de documento DTE
export const estadosDocumento: CatalogoItem[] = [
  { codigo: '001', descripcion: 'Transmitido satisfactoriamente' },
  { codigo: '002', descripcion: 'Ajustado' },
  { codigo: '003', descripcion: 'Observado' },
  { codigo: '004', descripcion: 'Rechazado' },
  { codigo: '005', descripcion: 'Invalidado' },
  { codigo: '006', descripcion: 'En contingencia' },
  { codigo: '007', descripcion: 'Pendiente de transmisión' },
];

// Ambiente
export const ambientes: CatalogoItem[] = [
  { codigo: '00', descripcion: 'Pruebas' },
  { codigo: '01', descripcion: 'Producción' },
];

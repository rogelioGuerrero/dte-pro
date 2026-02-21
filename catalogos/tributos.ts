// Catálogo de Tributos
// CAT-015: Tributos según especificación del Ministerio de Hacienda

export interface Tributo {
  codigo: string;
  descripcion: string;
  porcentaje: number | null;
  aplicaA: string[];
}

// Tributos aplicables a DTE - Catálogo oficial MH
export const tributos: Tributo[] = [
  // Sección 1: Tributos que no forman parte de la base imponible
  { 
    codigo: '20', 
    descripcion: 'IVA', 
    porcentaje: 0.13,
    aplicaA: ['01', '02', '03', '05', '06', '10', '11']
  },
  { 
    codigo: '50', 
    descripcion: 'Impuesto específico de venta al cemento', 
    porcentaje: null,
    aplicaA: ['01', '03']
  },
  { 
    codigo: '51', 
    descripcion: 'Impuesto específico de venta al producto de tabaco', 
    porcentaje: null,
    aplicaA: ['01', '03']
  },
  { 
    codigo: '52', 
    descripcion: 'Impuesto específico de venta a bebidas alcohólicas', 
    porcentaje: null,
    aplicaA: ['01', '03']
  },
  { 
    codigo: '53', 
    descripcion: 'Impuesto específico de venta a jabones y detergentes', 
    porcentaje: null,
    aplicaA: ['01', '03']
  },
  { 
    codigo: '54', 
    descripcion: 'Impuesto específico de venta a las bolsas plásticas', 
    porcentaje: null,
    aplicaA: ['01', '03']
  },
  { 
    codigo: '55', 
    descripcion: 'Impuesto específico de venta a bebidas azucaradas', 
    porcentaje: null,
    aplicaA: ['01', '03']
  },
  
  // Sección 2: Tributos sujetos al cálculo de IVA
  { 
    codigo: 'A6', 
    descripcion: 'Impuesto sobre Transferencia de Bienes Industrializados', 
    porcentaje: null,
    aplicaA: ['01', '03']
  },
  { 
    codigo: 'A8', 
    descripcion: 'Impuesto sobre Ventas al Consumo', 
    porcentaje: null,
    aplicaA: ['01', '03']
  },
  { 
    codigo: '57', 
    descripcion: 'Impuesto sobre Combustibles Líquidos', 
    porcentaje: null,
    aplicaA: ['01', '03']
  },
  { 
    codigo: 'D4', 
    descripcion: 'Impuesto Específico de la harina de trigo', 
    porcentaje: null,
    aplicaA: ['01', '03']
  },
  { 
    codigo: 'D5', 
    descripcion: 'Impuesto al azúcar', 
    porcentaje: null,
    aplicaA: ['01', '03']
  },
  
  // Sección 3: Códigos de diferenciales de precios
  { 
    codigo: '70', 
    descripcion: 'Diferencial de Precios de Café', 
    porcentaje: null,
    aplicaA: ['01', '03']
  },
  { 
    codigo: '71', 
    descripcion: 'Diferencial de Precios de Azúcar', 
    porcentaje: null,
    aplicaA: ['01', '03']
  },
  { 
    codigo: '72', 
    descripcion: 'Diferencial de Precios de Alcohol', 
    porcentaje: null,
    aplicaA: ['01', '03']
  },
  { 
    codigo: '73', 
    descripcion: 'Diferencial de Precios de Cemento', 
    porcentaje: null,
    aplicaA: ['01', '03']
  },
  { 
    codigo: '74', 
    descripcion: 'Diferencial de Precios de Fertilizantes', 
    porcentaje: null,
    aplicaA: ['01', '03']
  },
];

// Obtener tributos por tipo de documento
export const getTributosPorDocumento = (tipoDoc: string): Tributo[] => {
  return tributos.filter(t => t.aplicaA.includes(tipoDoc));
};

// Obtener tributo por código
export const getTributoPorCodigo = (codigo: string): Tributo | undefined => {
  return tributos.find(t => t.codigo === codigo);
};

// Tributos de retención
export const tributosRetencion: Tributo[] = tributos.filter(t => 
  ['C8', '59', 'D1'].includes(t.codigo)
);

// Tributos de percepción
export const tributosPercepcion: Tributo[] = tributos.filter(t => 
  ['D4'].includes(t.codigo)
);

// IVA estándar
export const IVA_ESTANDAR = tributos.find(t => t.codigo === '20')!;

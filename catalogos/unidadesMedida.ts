// CAT-014: Unidades de Medida
// Catálogo oficial del Ministerio de Hacienda de El Salvador

export interface UnidadMedida {
  codigo: number;
  descripcion: string;
  abreviatura: string;
}

export const unidadesMedida: UnidadMedida[] = [
  { codigo: 59, descripcion: 'Unidad', abreviatura: 'und' },
  { codigo: 60, descripcion: 'Kilogramo', abreviatura: 'kg' },
  { codigo: 61, descripcion: 'Libra', abreviatura: 'lb' },
  { codigo: 62, descripcion: 'Litro', abreviatura: 'L' },
  { codigo: 63, descripcion: 'Galón', abreviatura: 'gal' },
  { codigo: 64, descripcion: 'Metro', abreviatura: 'm' },
  { codigo: 65, descripcion: 'Metro cuadrado', abreviatura: 'm²' },
  { codigo: 66, descripcion: 'Metro cúbico', abreviatura: 'm³' },
  { codigo: 70, descripcion: 'Hora', abreviatura: 'hr' },
  { codigo: 71, descripcion: 'Día', abreviatura: 'día' },
  { codigo: 72, descripcion: 'Semana', abreviatura: 'sem' },
  { codigo: 73, descripcion: 'Mes', abreviatura: 'mes' },
  { codigo: 74, descripcion: 'Año', abreviatura: 'año' },
  { codigo: 99, descripcion: 'Servicio', abreviatura: 'serv' },
];

// Unidades más comunes (para mostrar primero en selectores)
export const unidadesMedidaComunes: number[] = [59, 99, 70, 71, 73, 60, 62, 64];

// Obtener unidad por código
export const getUnidadPorCodigo = (codigo: number): UnidadMedida | undefined => {
  return unidadesMedida.find(u => u.codigo === codigo);
};

// Ordenar unidades poniendo las comunes primero
export const getUnidadesOrdenadas = (): UnidadMedida[] => {
  const comunes = unidadesMedida.filter(u => unidadesMedidaComunes.includes(u.codigo));
  const otras = unidadesMedida.filter(u => !unidadesMedidaComunes.includes(u.codigo));
  return [...comunes, ...otras];
};

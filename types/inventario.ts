// Tipos de datos para el sistema de inventario simplificado

export interface Lote {
  id: string;
  proveedorId: string;
  proveedorNombre: string;
  cantidad: number;
  costoUnitario: number;
  fechaEntrada: Date;
  codigoProveedor?: string; // Código del proveedor (ej: "14848")
  codigoHacienda: string; // Código interno para Hacienda
}

export interface PresentacionProducto {
  nombre: string;
  factor: number;
}

export interface Producto {
  id: string;
  descripcion: string;
  categoria: string;
  codigo?: string; // Código interno opcional
  codigoPrincipal?: string; // Código del proveedor más usado

  activo: boolean;

  unidadBase?: string;
  presentaciones?: PresentacionProducto[];
  presentacionesPendientes?: string[];
  
  // Información de inventario
  existenciasTotales: number;
  costoPromedio: number;
  precioSugerido: number;
  
  // Control de lotes (interno, transparente para usuario)
  lotes: Lote[];
  
  // Metadata
  proveedores: string[]; // Nombres de proveedores únicos
  fechaUltimaCompra: Date;
  fechaUltimaVenta?: Date;
  esFavorito: boolean;
  gestionarInventario: boolean; // false para servicios
  
  // Para detección de similitud
  palabrasClave: string[];
  variantes: string[]; // Diferentes descripciones similares encontradas
  
  // Imágenes
  hasImage?: boolean;
  imageTimestamp?: number; // Para cache busting
}

export interface Proveedor {
  id: string;
  nombre: string;
  nrc?: string;
  nit?: string;
  categoria?: string;
  contacto?: {
    telefono?: string;
    correo?: string;
    direccion?: string;
  };
  fechaUltimaCompra: Date;
  totalCompras: number;
}

export interface MovimientoInventario {
  id: string;
  productoId: string;
  tipo: 'entrada' | 'salida';
  cantidad: number;
  unidad?: string;
  cantidadOriginal?: number;
  factorConversion?: number;
  costoUnitario?: number;
  precioUnitario?: number;
  loteId?: string;
  documentoReferencia: string; // Número de control de DTE
  fecha: Date;
  proveedorNombre?: string; // Para entradas
  clienteNombre?: string; // Para salidas
}

export interface ConfiguracionInventario {
  metodoCosteo: 'UEPS' | 'PEPS' | 'PROMEDIO'; // Últimas entradas, primeras salidas / Primeras entradas, primeras salidas / Costo promedio
  margenSugerido: number; // Por defecto 40%
  alertaBajoStock: number; // Umbral para alertar
  permitirVentaSinStock: boolean;
}

export interface CategoriaAuto {
  nombre: string;
  palabrasClave: string[];
  icono?: string; // Emoji o icono para mostrar
}

export interface ResumenInventario {
  totalProductos: number;
  totalCategorias: number;
  valorTotalInventario: number;
  productosBajoStock: number;
  sinInventario: number;
  categorias: {
    [key: string]: {
      cantidad: number;
      valor: number;
      productos: number;
    };
  };
}

// Para la interfaz de facturación
export interface ProductoFactura {
  producto: Producto;
  cantidad: number;
  precioUnitario: number;
  descuento?: number;
  loteSeleccionado?: Lote; // Interno, transparente
}

// Para reportes
export interface ReporteKardex {
  productoId: string;
  descripcion: string;
  codigo: string;
  movimientos: MovimientoKardex[];
  saldoFinal: {
    cantidad: number;
    valor: number;
  };
}

export interface MovimientoKardex {
  fecha: Date;
  documento: string;
  tipo: 'ENTRADA' | 'SALIDA';
  cantidad: number;
  costoUnitario: number;
  valor: number;
  saldoCantidad: number;
  saldoValor: number;
}

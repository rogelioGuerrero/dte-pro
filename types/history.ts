// Tipos para el historial de DTEs desde el backend
export interface DTEHistoryItem {
  codigoGeneracion: string;
  tipoDte: string;
  numeroControl: string;
  estado: "PROCESADO" | "RECHAZADO" | "PENDIENTE";
  createdAt: string;
  montoTotal: number;
  receptorNombre: string;
  receptorNit: string;
  selloRecibido?: string;
  tienePdf: boolean;
  tieneXml: boolean;
}

export interface DTEHistoryResponse {
  businessId: string;
  dtes: DTEHistoryItem[];
  total: number;
  pagination: {
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

export interface DTEHistoryParams {
  search?: string;
  fechaDesde?: string;
  fechaHasta?: string;
  tipo?: string;
  estado?: string;
  limit?: number;
  offset?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

// Tipos para el resumen de ventas
export interface ResumenVentasResponse {
  businessId: string;
  periodo: {
    fechaDesde: string;
    fechaHasta: string;
  };
  resumen: {
    totalVentas: number;
    totalIva: number;
    totalGravada: number;
    totalExenta: number;
    cantidadDocumentos: number;
    detallePorTipo: {
      [tipoDte: string]: {
        cantidad: number;
        total: number;
      };
    };
  };
}

export interface ResumenVentasParams {
  fechaDesde: string;
  fechaHasta: string;
  tipoDte?: string;
}

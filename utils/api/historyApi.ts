import { BACKEND_CONFIG, getBackendAuthToken } from '../backendConfig';
import { apiFetch } from '../apiClient';
import type { DTEHistoryParams, DTEHistoryResponse, ResumenVentasParams, ResumenVentasResponse } from '../../types/history';

/**
 * Obtiene el listado de DTEs de un negocio
 */
export async function getDTEHistory(businessId: string, params?: DTEHistoryParams): Promise<DTEHistoryResponse> {
  const queryParams = new URLSearchParams();
  
  if (params?.search) queryParams.append('search', params.search);
  if (params?.fechaDesde) queryParams.append('fechaDesde', params.fechaDesde);
  if (params?.fechaHasta) queryParams.append('fechaHasta', params.fechaHasta);
  if (params?.tipo) queryParams.append('tipo', params.tipo);
  if (params?.estado) queryParams.append('estado', params.estado);
  if (params?.limit) queryParams.append('limit', params.limit.toString());
  if (params?.offset) queryParams.append('offset', params.offset.toString());

  return apiFetch<DTEHistoryResponse>(`/api/dte/business/${businessId}/dtes?${queryParams.toString()}`, {
    method: 'GET',
  });
}

/**
 * Obtiene el resumen de ventas de un negocio
 */
export async function getResumenVentas(businessId: string, params: ResumenVentasParams): Promise<ResumenVentasResponse> {
  const queryParams = new URLSearchParams();
  queryParams.append('fechaDesde', params.fechaDesde);
  queryParams.append('fechaHasta', params.fechaHasta);
  if (params.tipoDte) queryParams.append('tipoDte', params.tipoDte);

  return apiFetch<ResumenVentasResponse>(`/api/dte/business/${businessId}/resumen?${queryParams.toString()}`, {
    method: 'GET',
  });
}

/**
 * Descarga el PDF de un DTE
 */
export async function downloadDTEPdf(businessId: string, codigoGeneracion: string): Promise<Blob> {
  const token = getBackendAuthToken();
  const response = await fetch(
    `${BACKEND_CONFIG.API_URL}/api/dte/business/${businessId}/dtes/${codigoGeneracion}/pdf`,
    {
      method: 'GET',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Error al descargar PDF: ${response.statusText}`);
  }

  return response.blob();
}

/**
 * Descarga el XML de un DTE
 */
export async function downloadDTEXml(businessId: string, codigoGeneracion: string): Promise<Blob> {
  const token = getBackendAuthToken();
  const response = await fetch(
    `${BACKEND_CONFIG.API_URL}/api/dte/business/${businessId}/dtes/${codigoGeneracion}/xml`,
    {
      method: 'GET',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Error al descargar XML: ${response.statusText}`);
  }

  return response.blob();
}

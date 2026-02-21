export interface ProcessError {
  severity: 'error' | 'warning';
  category: 'auth' | 'data' | 'math' | 'contingency' | 'network' | 'system';
  code: string;
  userMessage: string;
  canRetry: boolean;
  details?: string[];
}

export interface DteProcessData {
  codigoGeneracion: string;
  numeroControl: string;
  fechaHoraRecepcion?: string;
  selloRecepcion?: string;
  estado: string;
  pdfUrl?: string;
  xmlUrl?: string;
  jsonUrl?: string;
}

export interface DteProcessResponse {
  success: boolean;
  data?: DteProcessData;
  error?: ProcessError;
}

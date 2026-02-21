// Re-exportar desde el sistema modular de IA
// Mantiene compatibilidad con imports existentes
export { 
  extractTaxPayerData as extractDataFromImage,
  INITIAL_TAX_PAYER_DATA as INITIAL_DATA,
  getCurrentProviderName,
  getAvailableProviders,
} from './ai';

export type { TaxPayerData } from './ai';

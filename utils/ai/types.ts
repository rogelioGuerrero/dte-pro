// Tipos compartidos para proveedores de IA/OCR

export interface TaxPayerData {
  name: string;
  nit: string;
  nrc: string;
  activity: string;
  address: string;
  phone?: string;
  email?: string;
}

export const INITIAL_TAX_PAYER_DATA: TaxPayerData = {
  name: '',
  nit: '',
  nrc: '',
  activity: '',
  address: '',
  phone: '',
  email: '',
};

export interface AIProviderConfig {
  apiKey: string;
  model?: string;
  endpoint?: string;
}

export interface AIProvider {
  name: string;
  extractTaxPayerData(base64Image: string, config: AIProviderConfig): Promise<TaxPayerData>;
}

export type AIProviderType = 'gemini' | 'openai' | 'deepseek' | 'anthropic';

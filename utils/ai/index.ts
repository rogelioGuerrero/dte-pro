// Sistema de IA modular - permite intercambiar proveedores facilmente
import { AIProvider, AIProviderConfig, AIProviderType, TaxPayerData } from './types';
import { geminiProvider } from './geminiProvider';
import { loadSettings } from '../settings';

export * from './types';

// Registro de proveedores disponibles
const providers: Record<AIProviderType, AIProvider> = {
  gemini: geminiProvider,
  openai: geminiProvider, // TODO: implementar openaiProvider
  deepseek: geminiProvider, // TODO: implementar deepseekProvider
  anthropic: geminiProvider, // TODO: implementar anthropicProvider
};

// Obtener el proveedor actual desde settings
const getCurrentProvider = (): { provider: AIProvider; config: AIProviderConfig } => {
  const settings = loadSettings();
  const providerType: AIProviderType = (settings.aiProvider as AIProviderType) || 'gemini';
  const apiKey = settings.apiKey || (import.meta.env.VITE_GEMINI_API_KEY as string | undefined) || '';
  
  return {
    provider: providers[providerType] || providers.gemini,
    config: {
      apiKey,
      model: settings.aiModel,
    },
  };
};

// Funcion principal para extraer datos de contribuyente
export const extractTaxPayerData = async (base64Image: string): Promise<TaxPayerData> => {
  const { provider, config } = getCurrentProvider();
  return provider.extractTaxPayerData(base64Image, config);
};

// Obtener nombre del proveedor actual
export const getCurrentProviderName = (): string => {
  const { provider } = getCurrentProvider();
  return provider.name;
};

// Lista de proveedores disponibles
export const getAvailableProviders = (): { id: AIProviderType; name: string }[] => [
  { id: 'gemini', name: 'Google Gemini' },
  { id: 'openai', name: 'OpenAI GPT-4 Vision' },
  { id: 'deepseek', name: 'DeepSeek' },
  { id: 'anthropic', name: 'Anthropic Claude' },
];

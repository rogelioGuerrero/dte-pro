/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GEMINI_API_KEY: string;
  readonly VITE_MH_MODE?: 'sandbox' | 'prod';
  readonly VITE_MH_PROXY_URL?: string;
  readonly VITE_PLATFORM_FEE_THRESHOLD_CENTS?: string;
  readonly VITE_PLATFORM_FEE_FIXED_CENTS?: string;
  readonly VITE_PLATFORM_FEE_RATE?: string;
  readonly VITE_CARD_PROCESSING_RATE?: string;
  readonly VITE_CARD_PROCESSING_FIXED_CENTS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

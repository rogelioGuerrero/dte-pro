import { DTEJSON } from '../dteGenerator';
import { MonthlyTaxAccumulator } from '../tax/types';

export interface DTEState {
  // Inputs
  rawInput?: any;
  passwordPri?: string; // Contraseña para firma
  ambiente?: '00' | '01'; // 00=Pruebas, 01=Producción
  
  // DTE Data
  dte?: DTEJSON;
  
  // Validation
  isValid: boolean;
  validationErrors: string[];
  
  // Signing
  isSigned: boolean;
  signature?: string; // JWS
  
  // MH Transmission
  mhResponse?: any;
  isTransmitted: boolean;
  
  // Contingency
  isOffline: boolean;
  contingencyReason?: string;
  
  // Tax Impact
  taxImpact?: Partial<MonthlyTaxAccumulator>;
  
  // Workflow Control
  flowType: 'emission' | 'reception'; // Nuevo campo para diferenciar flujo
  status: 'draft' | 'validating' | 'signing' | 'transmitting' | 'completed' | 'failed' | 'contingency' | 'processing_reception';
  retryCount: number;
  
  // Allow dynamic properties for LangGraph internal state handling
  [key: string]: any;
}

export const INITIAL_STATE: DTEState = {
  flowType: 'emission', // Default a emisión
  isValid: false,
  validationErrors: [],
  isSigned: false,
  isTransmitted: false,
  isOffline: false,
  status: 'draft',
  retryCount: 0,
  ambiente: '00'
};

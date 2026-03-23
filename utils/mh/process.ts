import type { DTEJSON } from '../dteGenerator';
import type { ErrorValidacionMH } from './types';
import { normalizeDTE } from './normalize';

export interface ProcessDTEResult {
  dte: DTEJSON;
  errores: ErrorValidacionMH[];
}

export const processDTE = (input: DTEJSON): ProcessDTEResult => {
  const dte = normalizeDTE(input);
  // El backend valida el contrato final; en frontend solo normalizamos para no bloquear emisiones válidas.
  return { dte, errores: [] };
};

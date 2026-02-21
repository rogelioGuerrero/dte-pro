import type { EstadoTransmision } from './mh/types';

export type { AdvertenciaMH, ErrorValidacionMH, EstadoTransmision, TransmisionResult } from './mh/types';

// Configuración de endpoints (para cuando se conecte a producción)
export const ENDPOINTS_MH = {
  pruebas: {
    autenticacion: 'https://apitest.dtes.mh.gob.sv/seguridad/auth',
    recepcion: 'https://apitest.dtes.mh.gob.sv/fesv/recepciondte',
    consulta: 'https://apitest.dtes.mh.gob.sv/fesv/consultadte',
    anulacion: 'https://apitest.dtes.mh.gob.sv/fesv/anulardte',
  },
  produccion: {
    autenticacion: 'https://api.dtes.mh.gob.sv/seguridad/auth',
    recepcion: 'https://api.dtes.mh.gob.sv/fesv/recepciondte',
    consulta: 'https://api.dtes.mh.gob.sv/fesv/consultadte',
    anulacion: 'https://api.dtes.mh.gob.sv/fesv/anulardte',
  },
};

export interface ProgresoTransmision {
  estado: EstadoTransmision;
  mensaje: string;
  porcentaje: number;
}

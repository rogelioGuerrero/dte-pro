import { useState, useEffect, useMemo } from 'react';
import {
  tiposDocumento,
  tiposTransmision,
  tiposModelo,
  tiposEstablecimiento,
  tiposItem,
  condicionesOperacion,
  tiposContingencia,
  tiposDocumentoIdentificacion,
  tiposInvalidacion,
  estadosDocumento,
  ambientes,
  tributos,
  formasPago,
  plazos,
  unidadesMedida,
  departamentos,
  actividadesEconomicas,
  paises,
  incoterms,
  modosTransporte,
} from '../catalogos';

export interface Catalogos {
  // Documentos
  tiposDocumento: typeof tiposDocumento;
  tiposTransmision: typeof tiposTransmision;
  tiposModelo: typeof tiposModelo;
  tiposEstablecimiento: typeof tiposEstablecimiento;
  tiposItem: typeof tiposItem;
  condicionesOperacion: typeof condicionesOperacion;
  tiposContingencia: typeof tiposContingencia;
  tiposDocumentoIdentificacion: typeof tiposDocumentoIdentificacion;
  tiposInvalidacion: typeof tiposInvalidacion;
  estadosDocumento: typeof estadosDocumento;
  ambientes: typeof ambientes;
  // Tributos
  tributos: typeof tributos;
  // Pagos
  formasPago: typeof formasPago;
  plazos: typeof plazos;
  // Unidades
  unidadesMedida: typeof unidadesMedida;
  // Ubicación
  departamentos: typeof departamentos;
  // Actividades
  actividadesEconomicas: typeof actividadesEconomicas;
  // Exportación
  paises: typeof paises;
  incoterms: typeof incoterms;
  modosTransporte: typeof modosTransporte;
}

export const useCatalogos = () => {
  const [loading, setLoading] = useState(true);

  const catalogos: Catalogos = useMemo(() => ({
    // Documentos
    tiposDocumento,
    tiposTransmision,
    tiposModelo,
    tiposEstablecimiento,
    tiposItem,
    condicionesOperacion,
    tiposContingencia,
    tiposDocumentoIdentificacion,
    tiposInvalidacion,
    estadosDocumento,
    ambientes,
    // Tributos
    tributos,
    // Pagos
    formasPago,
    plazos,
    // Unidades
    unidadesMedida,
    // Ubicación
    departamentos,
    // Actividades
    actividadesEconomicas,
    // Exportación
    paises,
    incoterms,
    modosTransporte,
  }), []);

  useEffect(() => {
    // Simular carga (los catálogos ya están importados estáticamente)
    setLoading(false);
  }, []);

  return { catalogos, loading };
};

export default useCatalogos;

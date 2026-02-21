// Hook para manejo de cache temporal de DTEs
// Implementa la estrategia de sincronización con backend

import { useState, useEffect, useCallback } from 'react';
import {
  DTECacheRecord,
  DTECacheFilter,
  sincronizarCacheConBackend,
  guardarDTEComoPending,
  actualizarDTEConRespuesta,
  marcarDTEComoFallido,
  limpiarCacheAntiguo,
  obtenerCacheDTE
} from '../utils/dteHistoryDb';
import { TransmisionResult } from '../utils/dteSignature';
import { DTEJSON } from '../utils/dteGenerator';

interface UseDTECacheReturn {
  // Estado
  cacheRecords: DTECacheRecord[];
  isLoading: boolean;
  error: string | null;
  
  // Estadísticas
  stats: {
    total: number;
    pending: number;
    completed: number;
    failed: number;
    contingency: number;
  };
  
  // Acciones
  sincronizar: () => Promise<void>;
  refrescar: () => Promise<void>;
  limpiarCache: (dias?: number) => Promise<number>;
  guardarComoPending: (dte: DTEJSON, ambiente?: '00' | '01') => Promise<void>;
  actualizarConRespuesta: (codigo: string, respuesta: TransmisionResult) => Promise<void>;
  marcarComoFallido: (codigo: string, errores: string[]) => Promise<void>;
  
  // Consultas
  obtenerPorStatus: (status: 'pending' | 'completed' | 'failed' | 'contingency') => DTECacheRecord[];
  filtrar: (filtros: DTECacheFilter) => Promise<DTECacheRecord[]>;
}

export const useDTECache = (filtrosIniciales: DTECacheFilter = {}): UseDTECacheReturn => {
  const [cacheRecords, setCacheRecords] = useState<DTECacheRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filtros, setFiltros] = useState<DTECacheFilter>(filtrosIniciales);

  // Calcular estadísticas
  const stats = {
    total: cacheRecords.length,
    pending: cacheRecords.filter(r => r.status === 'pending').length,
    completed: cacheRecords.filter(r => r.status === 'completed').length,
    failed: cacheRecords.filter(r => r.status === 'failed').length,
    contingency: cacheRecords.filter(r => r.status === 'contingency').length,
  };

  // Cargar datos del cache
  const cargarCache = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const { registros } = await obtenerCacheDTE(filtros);
      setCacheRecords(registros);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error cargando cache');
      console.error('Error cargando cache DTE:', err);
    } finally {
      setIsLoading(false);
    }
  }, [filtros]);

  // Sincronizar con backend
  const sincronizar = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const resultado = await sincronizarCacheConBackend();
      
      if (resultado.errores.length > 0) {
        setError(resultado.errores.join(', '));
      }
      
      // Recargar cache después de sincronizar
      await cargarCache();
      
      console.log(`Sincronización completada: ${resultado.sincronizados} registros procesados`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error en sincronización');
      console.error('Error sincronizando cache:', err);
    } finally {
      setIsLoading(false);
    }
  }, [cargarCache]);

  // Refrescar cache
  const refrescar = useCallback(async () => {
    await cargarCache();
  }, [cargarCache]);

  // Limpiar cache antiguo
  const limpiarCache = useCallback(async (dias: number = 30) => {
    try {
      const eliminados = await limpiarCacheAntiguo(dias);
      await cargarCache(); // Recargar después de limpiar
      return eliminados;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error limpiando cache');
      throw err;
    }
  }, [cargarCache]);

  // Guardar DTE como pendiente
  const guardarComoPending = useCallback(async (dte: DTEJSON, ambiente: '00' | '01' = '00') => {
    try {
      await guardarDTEComoPending(dte, ambiente);
      await cargarCache(); // Recargar para mostrar el nuevo pending
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error guardando DTE pendiente');
      throw err;
    }
  }, [cargarCache]);

  // Actualizar DTE con respuesta del backend
  const actualizarConRespuesta = useCallback(async (codigoGeneracion: string, respuesta: TransmisionResult) => {
    try {
      await actualizarDTEConRespuesta(codigoGeneracion, respuesta);
      await cargarCache(); // Recargar para mostrar el estado actualizado
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error actualizando DTE');
      throw err;
    }
  }, [cargarCache]);

  // Marcar DTE como fallido
  const marcarComoFallido = useCallback(async (codigoGeneracion: string, errores: string[]) => {
    try {
      await marcarDTEComoFallido(codigoGeneracion, errores);
      await cargarCache(); // Recargar para mostrar el estado actualizado
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error marcando DTE como fallido');
      throw err;
    }
  }, [cargarCache]);

  // Obtener registros por status
  const obtenerPorStatus = useCallback((status: 'pending' | 'completed' | 'failed' | 'contingency') => {
    return cacheRecords.filter(r => r.status === status);
  }, [cacheRecords]);

  // Filtrar registros
  const filtrar = useCallback(async (nuevosFiltros: DTECacheFilter) => {
    setFiltros(nuevosFiltros);
    const { registros } = await obtenerCacheDTE(nuevosFiltros);
    return registros;
  }, []);

  // Efecto para cargar datos iniciales
  useEffect(() => {
    cargarCache();
  }, [cargarCache]);

  // Efecto para sincronización automática (cada 5 minutos)
  useEffect(() => {
    const interval = setInterval(() => {
      // Solo sincronizar si no hay operaciones en curso
      if (!isLoading) {
        sincronizar();
      }
    }, 5 * 60 * 1000); // 5 minutos

    return () => clearInterval(interval);
  }, [sincronizar, isLoading]);

  // Efecto para limpieza automática (cada 24 horas)
  useEffect(() => {
    const cleanupInterval = setInterval(async () => {
      if (!isLoading) {
        try {
          await limpiarCacheAntiguo(30);
          await cargarCache();
        } catch (err) {
          console.error('Error en limpieza automática:', err);
        }
      }
    }, 24 * 60 * 60 * 1000); // 24 horas

    return () => clearInterval(cleanupInterval);
  }, [cargarCache, isLoading]);

  return {
    // Estado
    cacheRecords,
    isLoading,
    error,
    
    // Estadísticas
    stats,
    
    // Acciones
    sincronizar,
    refrescar,
    limpiarCache,
    guardarComoPending,
    actualizarConRespuesta,
    marcarComoFallido,
    
    // Consultas
    obtenerPorStatus,
    filtrar,
  };
};

export const useDTEPendientes = () => {
  const { 
    cacheRecords, 
    isLoading, 
    error, 
    sincronizar,
    marcarComoFallido 
  } = useDTECache({ status: 'pending' });

  const pendientes = cacheRecords;
  const contingencias = cacheRecords.filter(r => r.status === 'contingency');

  const reintentarPendiente = useCallback(async (codigo: string) => {
    // TODO: Implementar lógica de reintento con backend
    console.log(`Reintentando DTE ${codigo}`);
    // Por ahora, solo marcamos como fallido para demostración
    await marcarComoFallido(codigo, ['Reintento no implementado']);
  }, [marcarComoFallido]);

  return {
    pendientes,
    contingencias,
    isLoading,
    error,
    reintentarPendiente,
    sincronizar,
  };
};

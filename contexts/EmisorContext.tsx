import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useAuth } from './AuthContext';
import { apiFetch } from '../utils/apiClient';

type BusinessRow = {
  business_id: string;
  nombre?: string | null;
  role?: string | null;
};

interface EmisorContextValue {
  businessId: string | null;
  setBusinessId: (id: string | null) => void;
  emisores: { business_id: string; nombre?: string; role?: string | null }[];
  loading: boolean;
  reload: () => Promise<void>;
  currentRole: string | null;
}

const STORAGE_KEY = 'dte_business_id';
const EmisorContext = createContext<EmisorContextValue | undefined>(undefined);

export const EmisorProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [businessId, setBusinessIdState] = useState<string | null>(() => localStorage.getItem(STORAGE_KEY));
  const [emisores, setEmisores] = useState<{ business_id: string; nombre?: string; role?: string | null }[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (businessId) {
      localStorage.setItem(STORAGE_KEY, businessId);
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, [businessId]);

  const load = async () => {
    if (!user) {
      setEmisores([]);
      setBusinessIdState(null);
      return;
    }
    setLoading(true);
    try {
      const raw = await apiFetch<unknown>('/api/business/businesses/me');
      const rows = Array.isArray(raw)
        ? (raw as BusinessRow[])
        : (Array.isArray((raw as any)?.data)
            ? ((raw as any).data as BusinessRow[])
            : (Array.isArray((raw as any)?.rows)
                ? ((raw as any).rows as BusinessRow[])
                : []));

      if (!Array.isArray(rows)) {
        throw new Error('Respuesta inválida: se esperaba un arreglo de emisores');
      }

      const mapped = rows.map((row) => ({
        business_id: row.business_id,
        nombre: row.nombre || undefined,
        role: row.role || null,
      }));
      setEmisores(mapped);
      if (!businessId && mapped.length > 0) {
        setBusinessIdState(mapped[0].business_id);
      }
    } catch (err) {
      console.error('Error cargando emisores', err);
      setEmisores([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [user]);

  const setBusinessId = (id: string | null) => {
    setBusinessIdState(id);
  };

  const currentRole = useMemo(() => {
    if (!businessId) return null;
    return emisores.find((e) => e.business_id === businessId)?.role || null;
  }, [businessId, emisores]);

  const value = useMemo<EmisorContextValue>(
    () => ({ businessId, setBusinessId, emisores, loading, reload: load, currentRole }),
    [businessId, emisores, loading, currentRole]
  );

  return <EmisorContext.Provider value={value}>{children}</EmisorContext.Provider>;
};

export const useEmisor = (): EmisorContextValue => {
  const ctx = useContext(EmisorContext);
  if (!ctx) throw new Error('useEmisor must be used within EmisorProvider');
  return ctx;
};

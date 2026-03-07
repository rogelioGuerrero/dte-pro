import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { apiFetch } from '../utils/apiClient';
import { getBackendAuthToken } from '../utils/backendConfig';

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

type BackendBusinessMembership = {
  business_id: string;
  nombre?: string;
  role?: string | null;
};

export const EmisorProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
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

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      const token = getBackendAuthToken();

      if (token) {
        try {
          const remoteBusinesses = await apiFetch<BackendBusinessMembership[]>('/api/business/businesses/me');
          setEmisores(remoteBusinesses);

          const hasStoredSelection = stored && remoteBusinesses.some((item) => item.business_id === stored);
          const nextBusinessId = hasStoredSelection
            ? stored
            : remoteBusinesses[0]?.business_id || stored || null;

          setBusinessIdState(nextBusinessId);
          return;
        } catch (error) {
          console.warn('No se pudieron cargar los emisores remotos; usando fallback local.', error);
        }
      }

      setBusinessIdState(stored);
      if (stored) {
        setEmisores([{ business_id: stored, nombre: localStorage.getItem('emisor_nombre') || stored, role: null }]);
      } else {
        setEmisores([]);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const setBusinessId = (id: string | null) => {
    setBusinessIdState(id);
  };

  const currentRole = useMemo(() => {
    return emisores.find((item) => item.business_id === businessId)?.role || null;
  }, [businessId, emisores]);

  const value = useMemo<EmisorContextValue>(
    () => ({ businessId, setBusinessId, emisores, loading, reload: load, currentRole }),
    [businessId, emisores, loading, load, currentRole]
  );

  return <EmisorContext.Provider value={value}>{children}</EmisorContext.Provider>;
};

export const useEmisor = (): EmisorContextValue => {
  const ctx = useContext(EmisorContext);
  if (!ctx) throw new Error('useEmisor must be used within EmisorProvider');
  return ctx;
};

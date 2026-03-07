import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { apiFetch } from '../utils/apiClient';
import { getBackendAuthToken } from '../utils/backendConfig';

export interface EmisorMembership {
  id?: string;
  business_id: string;
  nit?: string;
  nombre?: string;
  role?: string | null;
}

interface EmisorContextValue {
  businessId: string | null;
  operationalBusinessId: string | null;
  setBusinessId: (id: string | null) => void;
  emisores: EmisorMembership[];
  loading: boolean;
  reload: () => Promise<void>;
  currentRole: string | null;
  selectedEmisor: EmisorMembership | null;
}

const STORAGE_KEY = 'dte_business_id';
const EmisorContext = createContext<EmisorContextValue | undefined>(undefined);

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const isUuid = (value: string | null | undefined) => Boolean(value && UUID_REGEX.test(value));

const getMembershipSelectionValue = (membership: EmisorMembership) => membership.id || membership.business_id;

const findMembershipBySelection = (memberships: EmisorMembership[], selection: string | null) => {
  if (!selection) return null;
  return memberships.find((item) => item.id === selection || item.business_id === selection) || null;
};

export const EmisorProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [selectedBusinessKey, setSelectedBusinessKey] = useState<string | null>(() => localStorage.getItem(STORAGE_KEY));
  const [emisores, setEmisores] = useState<EmisorMembership[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (selectedBusinessKey) {
      localStorage.setItem(STORAGE_KEY, selectedBusinessKey);
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, [selectedBusinessKey]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      const token = getBackendAuthToken();

      if (token) {
        try {
          const remoteBusinesses = await apiFetch<EmisorMembership[]>('/api/business/businesses/me');
          setEmisores(remoteBusinesses);

          const hasStoredSelection = Boolean(findMembershipBySelection(remoteBusinesses, stored));
          const nextBusinessId = hasStoredSelection
            ? stored
            : remoteBusinesses[0] ? getMembershipSelectionValue(remoteBusinesses[0]) : stored || null;

          setSelectedBusinessKey(nextBusinessId);
          return;
        } catch (error) {
          console.warn('No se pudieron cargar los emisores remotos; usando fallback local.', error);
        }
      }

      setSelectedBusinessKey(stored);
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

  useEffect(() => {
    const handleAuthChanged = () => {
      load();
    };

    window.addEventListener('dte-auth-changed', handleAuthChanged);
    return () => {
      window.removeEventListener('dte-auth-changed', handleAuthChanged);
    };
  }, [load]);

  const setBusinessId = (id: string | null) => {
    setSelectedBusinessKey(id);
  };

  const selectedEmisor = useMemo(() => findMembershipBySelection(emisores, selectedBusinessKey), [emisores, selectedBusinessKey]);

  const businessId = useMemo(() => selectedEmisor?.business_id || selectedBusinessKey || null, [selectedEmisor, selectedBusinessKey]);

  const operationalBusinessId = useMemo(() => {
    if (selectedEmisor?.id) return selectedEmisor.id;
    return isUuid(selectedBusinessKey) ? selectedBusinessKey : null;
  }, [selectedEmisor, selectedBusinessKey]);

  const currentRole = useMemo(() => {
    return selectedEmisor?.role || null;
  }, [selectedEmisor]);

  const value = useMemo<EmisorContextValue>(
    () => ({ businessId, operationalBusinessId, setBusinessId, emisores, loading, reload: load, currentRole, selectedEmisor }),
    [businessId, operationalBusinessId, emisores, loading, load, currentRole, selectedEmisor]
  );

  return <EmisorContext.Provider value={value}>{children}</EmisorContext.Provider>;
};

export const useEmisor = (): EmisorContextValue => {
  const ctx = useContext(EmisorContext);
  if (!ctx) throw new Error('useEmisor must be used within EmisorProvider');
  return ctx;
};

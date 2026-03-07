import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

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
  const [businessId, setBusinessIdState] = useState<string | null>(() => localStorage.getItem(STORAGE_KEY));
  const [emisores, setEmisores] = useState<{ business_id: string; nombre?: string; role?: string | null }[]>([]);
  const [loading] = useState(false);

  useEffect(() => {
    if (businessId) {
      localStorage.setItem(STORAGE_KEY, businessId);
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, [businessId]);

  const load = async () => {
    const stored = localStorage.getItem(STORAGE_KEY);
    setBusinessIdState(stored);
    if (stored) {
      setEmisores([{ business_id: stored, nombre: stored, role: null }]);
    } else {
      setEmisores([]);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const setBusinessId = (id: string | null) => {
    setBusinessIdState(id);
  };

  const currentRole = useMemo(() => {
    return null;
  }, []);

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

import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { supabase } from '../utils/supabaseClient';
import { useAuth } from './AuthContext';

type BusinessUserRow = {
  business_id: string;
};

interface EmisorContextValue {
  businessId: string | null;
  setBusinessId: (id: string | null) => void;
  emisores: { business_id: string; nombre?: string }[];
  loading: boolean;
}

const STORAGE_KEY = 'dte_business_id';
const EmisorContext = createContext<EmisorContextValue | undefined>(undefined);

export const EmisorProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [businessId, setBusinessIdState] = useState<string | null>(() => localStorage.getItem(STORAGE_KEY));
  const [emisores, setEmisores] = useState<{ business_id: string; nombre?: string }[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (businessId) {
      localStorage.setItem(STORAGE_KEY, businessId);
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, [businessId]);

  useEffect(() => {
    const load = async () => {
      if (!user) {
        setEmisores([]);
        return;
      }
      setLoading(true);
      const { data, error } = await supabase
        .from('business_users')
        .select('business_id')
        .eq('user_id', user.id);
      if (!error && data) {
        const mapped = (data as BusinessUserRow[]).map((row) => ({ business_id: row.business_id }));
        setEmisores(mapped);
        if (!businessId && mapped.length > 0) {
          setBusinessIdState(mapped[0].business_id);
        }
      }
      setLoading(false);
    };
    load();
  }, [user]);

  const setBusinessId = (id: string | null) => {
    setBusinessIdState(id);
  };

  const value = useMemo<EmisorContextValue>(() => ({ businessId, setBusinessId, emisores, loading }), [businessId, emisores, loading]);

  return <EmisorContext.Provider value={value}>{children}</EmisorContext.Provider>;
};

export const useEmisor = (): EmisorContextValue => {
  const ctx = useContext(EmisorContext);
  if (!ctx) throw new Error('useEmisor must be used within EmisorProvider');
  return ctx;
};

import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { isSupabaseConfigured, supabase } from '../utils/supabaseClient';

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  loading: boolean;
  isConfigured: boolean;
  signInWithPassword: (email: string, password: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  updatePassword: (password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function persistBackendToken(session: Session | null) {
  if (typeof window === 'undefined') return;

  if (session?.access_token) {
    window.localStorage.setItem('dte_jwt_token', session.access_token);
  } else {
    window.localStorage.removeItem('dte_jwt_token');
  }

  window.dispatchEvent(new CustomEvent('dte-auth-changed', {
    detail: { authenticated: Boolean(session?.access_token) }
  }));
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      setLoading(false);
      return;
    }

    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session ?? null);
      setUser(data.session?.user ?? null);
      persistBackendToken(data.session ?? null);
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession ?? null);
      setUser(nextSession?.user ?? null);
      persistBackendToken(nextSession ?? null);
      setLoading(false);
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    session,
    user,
    loading,
    isConfigured: isSupabaseConfigured,
    signInWithPassword: async (email: string, password: string) => {
      if (!supabase) throw new Error('Supabase no está configurado.');
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
    },
    resetPassword: async (email: string) => {
      if (!supabase) throw new Error('Supabase no está configurado.');
      const redirectTo = typeof window !== 'undefined'
        ? `${window.location.origin}${window.location.pathname}#type=recovery`
        : undefined;
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo,
      });
      if (error) throw error;
    },
    updatePassword: async (password: string) => {
      if (!supabase) throw new Error('Supabase no está configurado.');
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
    },
    signOut: async () => {
      if (!supabase) return;
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      persistBackendToken(null);
    },
  }), [session, user, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextValue => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};

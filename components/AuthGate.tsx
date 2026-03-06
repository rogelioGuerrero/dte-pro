import React, { useState } from 'react';
import { supabase } from '../utils/supabaseClient';
import { useAuth } from '../contexts/AuthContext';

interface AuthGateProps {
  children: React.ReactNode;
}

export const AuthGate: React.FC<AuthGateProps> = ({ children }) => {
  const { session, loading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [useMagicLink, setUseMagicLink] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const emailRedirectTo = (import.meta.env.VITE_SITE_URL || window.location.origin) as string;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setMessage(null);
    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        return;
      }

      if (useMagicLink) {
        const { error } = await supabase.auth.signInWithOtp({
          email,
          options: { emailRedirectTo }
        });
        if (error) throw error;
        setMessage('Te enviamos un enlace mágico. Revisa tu correo.');
        return;
      }

      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo }
      });
      if (error) throw error;
      setMessage('Cuenta creada. Revisa tu correo para confirmar.');
    } catch (err: any) {
      const msg = (err?.message || '').toLowerCase();
      if (msg.includes('rate limit')) {
        setError('Hemos enviado demasiados correos. Intenta de nuevo en unos minutos.');
      } else {
        setError(err?.message || 'No se pudo procesar la solicitud');
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 text-gray-600">
        Cargando sesión...
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-md bg-white shadow-lg rounded-xl p-6 space-y-4 border border-gray-200">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-semibold text-gray-900">
              {mode === 'login' ? 'Ingresar' : 'Crear cuenta'}
            </h1>
            <button
              type="button"
              onClick={() => {
                setMode((prev) => (prev === 'login' ? 'signup' : 'login'));
                setError(null);
                setMessage(null);
              }}
              className="text-sm font-medium text-indigo-600 hover:text-indigo-700"
            >
              {mode === 'login' ? 'Crear cuenta' : 'Ya tengo cuenta'}
            </button>
          </div>
          <form className="space-y-3" onSubmit={handleSubmit}>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Correo</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500"
                required
              />
            </div>
            <div className="space-y-2">
              <div className={`transition-opacity ${useMagicLink && mode === 'signup' ? 'opacity-50 pointer-events-none' : 'opacity-100'}`}>
                <label className="block text-sm font-medium text-gray-700 mb-1">Contraseña</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500"
                  required={!useMagicLink || mode === 'login'}
                  disabled={useMagicLink && mode === 'signup'}
                />
              </div>
              {mode === 'signup' && (
                <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    checked={useMagicLink}
                    onChange={(e) => setUseMagicLink(e.target.checked)}
                  />
                  Usar enlace mágico (sin contraseña)
                </label>
              )}
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            {message && <p className="text-sm text-green-600">{message}</p>}
            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-indigo-600 text-white py-2 rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-60"
            >
              {submitting
                ? mode === 'login'
                  ? 'Ingresando...'
                  : useMagicLink
                    ? 'Enviando enlace...'
                    : 'Creando cuenta...'
                : mode === 'login'
                  ? 'Ingresar'
                  : useMagicLink
                    ? 'Enviar enlace mágico'
                    : 'Crear cuenta'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

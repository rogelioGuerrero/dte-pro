import React, { useState } from 'react';
import { Mail, Shield } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { notify } from '../utils/notifications';

interface AuthGateProps {
  children: React.ReactNode;
}

export const AuthGate: React.FC<AuthGateProps> = ({ children }) => {
  const { user, loading, isConfigured, signInWithOtp } = useAuth();
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [lastEmailSent, setLastEmailSent] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const nextEmail = email.trim();
      await signInWithOtp(nextEmail);
      setLastEmailSent(nextEmail);
      notify('Revisa tu correo para abrir el enlace de acceso.', 'success');
    } catch (error) {
      console.error(error);
      notify((error as Error).message || 'No se pudo iniciar sesión.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isConfigured) {
    return <>{children}</>;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="bg-white border border-gray-200 rounded-2xl px-6 py-5 shadow-sm text-sm text-gray-600">
          Validando sesión...
        </div>
      </div>
    );
  }

  if (user) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl border border-gray-200 p-8 space-y-6">
        <div className="text-center space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-indigo-100 mx-auto flex items-center justify-center">
            <Shield className="w-7 h-7 text-indigo-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Acceso a DTE Pro</h1>
            <p className="text-sm text-gray-600 mt-2">
              Ingresa el correo de tu usuario registrado para recibir un enlace mágico e iniciar sesión.
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-indigo-100 bg-indigo-50 px-4 py-3 text-sm text-indigo-900 space-y-2">
          <p className="font-medium">Cómo entrar</p>
          <p>
            Si ya eres usuario o admin, escribe tu correo de Supabase y abre el enlace que llega a ese mismo correo. Esta pantalla <strong>no envía invitaciones</strong>; sirve para iniciar sesión.
          </p>
          <p className="text-xs text-indigo-700">
            Si tu correo además está registrado en <code>public.platform_admins</code>, backend te reconocerá como admin de plataforma después del login.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Correo</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-10 pr-3 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                placeholder="tu-correo@dominio.com"
                autoComplete="email"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting || !email.trim()}
            className="w-full py-3 rounded-xl bg-indigo-600 text-white font-medium hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {submitting ? 'Enviando enlace...' : 'Iniciar sesión por correo'}
          </button>
        </form>

        {lastEmailSent && (
          <div className="rounded-2xl border border-green-100 bg-green-50 px-4 py-3 text-sm text-green-800">
            Enlace enviado a <strong>{lastEmailSent}</strong>. Abre tu correo y vuelve a esta app desde el enlace mágico para completar el acceso.
          </div>
        )}

        <div className="text-xs text-gray-500 space-y-1">
          <p>- Usa el mismo correo con el que te registraron en Supabase Auth.</p>
          <p>- Si eres platform admin y aún no puedes administrar, falta que ese correo exista en <code>public.platform_admins</code> con <code>active=true</code>.</p>
        </div>
      </div>
    </div>
  );
};

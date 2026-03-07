import React, { useEffect, useState } from 'react';
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
  const [inlineMessage, setInlineMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);

  useEffect(() => {
    if (cooldownSeconds <= 0) return;
    const timer = window.setTimeout(() => {
      setCooldownSeconds((current) => Math.max(0, current - 1));
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [cooldownSeconds]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cooldownSeconds > 0) return;
    setSubmitting(true);
    setInlineMessage(null);
    try {
      const nextEmail = email.trim();
      await signInWithOtp(nextEmail);
      setLastEmailSent(nextEmail);
      setInlineMessage({ tone: 'success', text: `Revisa tu correo: ${nextEmail}` });
      notify('Revisa tu correo para abrir el enlace de acceso.', 'success');
    } catch (error) {
      console.error(error);
      const message = (error as Error).message || 'No se pudo iniciar sesión.';
      if (/rate limit|too many requests|429/i.test(message)) {
        setCooldownSeconds(45);
        setInlineMessage({ tone: 'error', text: 'Espera un momento antes de volver a intentar.' });
        notify('Espera un momento antes de volver a intentar.', 'error');
      } else {
        setInlineMessage({ tone: 'error', text: 'No se pudo iniciar sesión.' });
        notify(message, 'error');
      }
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
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-sm border border-gray-200 p-8 space-y-6">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-gray-100 mx-auto flex items-center justify-center border border-gray-200">
            <Shield className="w-5 h-5 text-indigo-600" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Acceso a DTE Pro</h1>
            <p className="text-sm text-gray-500 mt-2">
              Escribe tu correo para entrar.
            </p>
          </div>
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
                className="w-full pl-10 pr-3 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none bg-white"
                placeholder="tu-correo@dominio.com"
                autoComplete="email"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting || !email.trim() || cooldownSeconds > 0}
            className="w-full py-3 rounded-xl bg-indigo-600 text-white font-medium hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
            title="Te enviaremos un enlace para entrar"
          >
            {submitting ? 'Enviando...' : cooldownSeconds > 0 ? `Espera ${cooldownSeconds}s` : 'Iniciar sesión'}
          </button>
        </form>

        {inlineMessage && (
          <div className={`rounded-xl px-4 py-3 text-sm border ${inlineMessage.tone === 'success' ? 'bg-green-50 border-green-100 text-green-800' : 'bg-amber-50 border-amber-100 text-amber-800'}`}>
            {inlineMessage.text}
          </div>
        )}

        {!inlineMessage && lastEmailSent && (
          <div className="rounded-xl px-4 py-3 text-sm border bg-green-50 border-green-100 text-green-800">
            Revisa tu correo: <strong>{lastEmailSent}</strong>
          </div>
        )}
      </div>
    </div>
  );
};

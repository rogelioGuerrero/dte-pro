import React, { useEffect, useState } from 'react';
import { Mail, Shield } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { notify } from '../utils/notifications';

const OTP_COOLDOWN_STORAGE_KEY = 'dte_auth_otp_cooldown_until';
const DEFAULT_SEND_COOLDOWN_SECONDS = 60;
const RATE_LIMIT_COOLDOWN_SECONDS = 300;

interface AuthGateProps {
  children: React.ReactNode;
}

export const AuthGate: React.FC<AuthGateProps> = ({ children }) => {
  const { user, loading, isConfigured, signInWithOtp } = useAuth();
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [lastEmailSent, setLastEmailSent] = useState('');
  const [inlineMessage, setInlineMessage] = useState<{ tone: 'default' | 'success' | 'error'; text: string } | null>(null);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);

  useEffect(() => {
    const stored = window.localStorage.getItem(OTP_COOLDOWN_STORAGE_KEY);
    if (!stored) return;
    const remainingMs = Number(stored) - Date.now();
    if (remainingMs > 0) {
      setCooldownSeconds(Math.ceil(remainingMs / 1000));
      return;
    }
    window.localStorage.removeItem(OTP_COOLDOWN_STORAGE_KEY);
  }, []);

  useEffect(() => {
    if (cooldownSeconds <= 0) return;
    const timer = window.setTimeout(() => {
      setCooldownSeconds((current) => Math.max(0, current - 1));
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [cooldownSeconds]);

  useEffect(() => {
    if (cooldownSeconds <= 0) {
      window.localStorage.removeItem(OTP_COOLDOWN_STORAGE_KEY);
      return;
    }
    const nextUntil = Date.now() + cooldownSeconds * 1000;
    window.localStorage.setItem(OTP_COOLDOWN_STORAGE_KEY, String(nextUntil));
  }, [cooldownSeconds]);

  const startCooldown = (seconds: number) => {
    setCooldownSeconds(seconds);
  };

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
      startCooldown(DEFAULT_SEND_COOLDOWN_SECONDS);
      notify('Revisa tu correo para abrir el enlace de acceso.', 'success');
    } catch (error) {
      const message = (error as Error).message || 'No se pudo iniciar sesión.';
      if (/rate limit|too many requests|429/i.test(message)) {
        startCooldown(RATE_LIMIT_COOLDOWN_SECONDS);
        setInlineMessage({ tone: 'error', text: 'Demasiados intentos. Intenta de nuevo en unos minutos.' });
        notify('Demasiados intentos. Intenta de nuevo en unos minutos.', 'error');
      } else {
        setInlineMessage({ tone: 'error', text: 'No se pudo iniciar sesión.' });
        notify('No se pudo iniciar sesión.', 'error');
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
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-gray-50 mx-auto flex items-center justify-center border border-gray-200">
            <Shield className="w-5 h-5 text-indigo-600" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Acceso a DTE Pro</h1>
            <p className="text-sm text-gray-500 mt-2">
              Escribe tu correo para entrar.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 mt-8">
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
            {submitting ? 'Enviando...' : cooldownSeconds > 0 ? `Espera ${Math.ceil(cooldownSeconds / 60) > 1 ? `${Math.ceil(cooldownSeconds / 60)} min` : `${cooldownSeconds}s`}` : 'Iniciar sesión'}
          </button>
        </form>

        {inlineMessage && (
          <div className={`mt-4 rounded-xl px-4 py-3 text-sm border ${inlineMessage.tone === 'success' ? 'bg-green-50 border-green-100 text-green-800' : inlineMessage.tone === 'error' ? 'bg-amber-50 border-amber-100 text-amber-800' : 'bg-gray-50 border-gray-200 text-gray-700'}`}>
            {inlineMessage.text}
          </div>
        )}

        {!inlineMessage && lastEmailSent && (
          <div className="mt-4 rounded-xl px-4 py-3 text-sm border bg-green-50 border-green-100 text-green-800">
            Revisa tu correo: <strong>{lastEmailSent}</strong>
          </div>
        )}
      </div>
    </div>
  );
};

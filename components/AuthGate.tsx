import React, { useState } from 'react';
import { Eye, EyeOff, Lock, Mail, Shield } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { notify } from '../utils/notifications';

interface AuthGateProps {
  children: React.ReactNode;
}

export const AuthGate: React.FC<AuthGateProps> = ({ children }) => {
  const { user, loading, isConfigured, signInWithPassword, resetPassword, updatePassword } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [inlineMessage, setInlineMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);

  const isRecoveryMode = typeof window !== 'undefined'
    && new URLSearchParams(window.location.hash.replace(/^#/, '')).get('type') === 'recovery';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setInlineMessage(null);
    try {
      await signInWithPassword(email.trim(), password);
      notify('Sesión iniciada', 'success');
    } catch {
      setInlineMessage({ tone: 'error', text: 'Correo o contraseña incorrectos.' });
      notify('No se pudo iniciar sesión.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newPassword.trim() || newPassword.length < 8) {
      setInlineMessage({ tone: 'error', text: 'La nueva contraseña debe tener al menos 8 caracteres.' });
      return;
    }

    if (newPassword !== confirmPassword) {
      setInlineMessage({ tone: 'error', text: 'Las contraseñas no coinciden.' });
      return;
    }

    setSubmitting(true);
    setInlineMessage(null);
    try {
      await updatePassword(newPassword);
      setNewPassword('');
      setConfirmPassword('');
      if (typeof window !== 'undefined') {
        window.history.replaceState({}, document.title, window.location.pathname + window.location.search);
      }
      setInlineMessage({ tone: 'success', text: 'Contraseña actualizada. Ya puedes iniciar sesión.' });
      notify('Contraseña actualizada.', 'success');
    } catch {
      setInlineMessage({ tone: 'error', text: 'No se pudo actualizar la contraseña. Intenta abrir el enlace nuevamente.' });
      notify('No se pudo actualizar la contraseña.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetPassword = async () => {
    if (!email.trim()) {
      setInlineMessage({ tone: 'error', text: 'Escribe tu correo primero.' });
      return;
    }

    setSubmitting(true);
    setInlineMessage(null);
    try {
      await resetPassword(email.trim());
      setInlineMessage({ tone: 'success', text: 'Revisa tu correo para restablecer la contraseña.' });
      notify('Revisa tu correo para restablecer la contraseña.', 'success');
    } catch {
      setInlineMessage({ tone: 'error', text: 'No se pudo enviar la recuperación.' });
      notify('No se pudo enviar la recuperación.', 'error');
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
              Ingresa con tu correo y contraseña.
            </p>
          </div>
        </div>

        {isRecoveryMode ? (
          <form onSubmit={handleUpdatePassword} className="space-y-4 mt-8">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Nueva contraseña</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type={showNewPassword ? 'text' : 'password'}
                  required
                  minLength={8}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full pl-10 pr-10 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none bg-white"
                  placeholder="Mínimo 8 caracteres"
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword((current) => !current)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  title={showNewPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                >
                  {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Confirmar contraseña</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  required
                  minLength={8}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full pl-10 pr-10 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none bg-white"
                  placeholder="Repite la nueva contraseña"
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword((current) => !current)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  title={showConfirmPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting || !newPassword.trim() || !confirmPassword.trim()}
              className="w-full py-3 rounded-xl bg-indigo-600 text-white font-medium hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
              title="Guardar nueva contraseña"
            >
              {submitting ? 'Guardando...' : 'Guardar nueva contraseña'}
            </button>
          </form>
        ) : (
          <>
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

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Contraseña</label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-10 pr-10 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none bg-white"
                    placeholder="Tu contraseña"
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((current) => !current)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    title={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting || !email.trim() || !password.trim()}
                className="w-full py-3 rounded-xl bg-indigo-600 text-white font-medium hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                title="Entrar a tu cuenta"
              >
                {submitting ? 'Entrando...' : 'Entrar'}
              </button>
            </form>

            <div className="mt-4 flex justify-center">
              <button
                type="button"
                onClick={handleResetPassword}
                disabled={submitting || !email.trim()}
                className="text-sm text-gray-500 hover:text-gray-700 disabled:opacity-60"
                title="Enviar correo para restablecer contraseña"
              >
                Olvidé mi contraseña
              </button>
            </div>
          </>
        )}

        {inlineMessage && (
          <div className={`mt-4 rounded-xl px-4 py-3 text-sm border ${inlineMessage.tone === 'success' ? 'bg-green-50 border-green-100 text-green-800' : inlineMessage.tone === 'error' ? 'bg-amber-50 border-amber-100 text-amber-800' : 'bg-gray-50 border-gray-200 text-gray-700'}`}>
            {inlineMessage.text}
          </div>
        )}
      </div>
    </div>
  );
};

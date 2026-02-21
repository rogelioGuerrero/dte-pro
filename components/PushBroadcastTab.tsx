import React, { useState } from 'react';
import { Send, Bell, CheckCircle, AlertTriangle } from 'lucide-react';
import { notify } from '../utils/notifications';

export const PushBroadcastTab: React.FC = () => {
  const [formData, setFormData] = useState({
    title: '',
    body: '',
    target: 'all' as 'all' | 'specific'
  });
  
  const [loading, setLoading] = useState(false);
  const [sentCount, setSentCount] = useState<number | null>(null);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setSentCount(null);

    try {
      // Obtener token JWT y business_id del localStorage
      const token = localStorage.getItem('dte_token');
      const businessId = localStorage.getItem('dte_business_id');
      
      if (!token || !businessId) {
        throw new Error('No hay sesión activa. Por favor inicia sesión.');
      }

      if (!formData.title.trim() || !formData.body.trim()) {
        throw new Error('El título y el mensaje son obligatorios.');
      }

      const payload = {
        title: formData.title.trim(),
        body: formData.body.trim(),
        target: formData.target
      };

      const apiUrl = import.meta.env.VITE_API_DTE_URL || '';
      const response = await fetch(`${apiUrl}/api/admin/broadcast`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'x-business-id': businessId,
        },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Error enviando notificación');
      }

      setSentCount(data.sentCount || 0);
      notify(`Notificación enviada a ${data.sentCount || 0} usuarios`, 'success');
      
      // Limpiar formulario
      setFormData({ title: '', body: '', target: 'all' });

    } catch (error) {
      console.error(error);
      notify((error as Error).message, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Bell className="w-5 h-5 text-blue-600" />
        <div>
          <h3 className="text-lg font-semibold">Enviar Push (Broadcast)</h3>
          <p className="text-sm text-gray-600">
            Envía notificaciones a todos los usuarios de la aplicación
          </p>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSend} className="space-y-4">
        {/* Título */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Título <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            placeholder="Ej: Mantenimiento programado"
            maxLength={100}
            disabled={loading}
          />
          <p className="text-xs text-gray-500 mt-1">
            {formData.title.length}/100 caracteres
          </p>
        </div>

        {/* Mensaje */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Mensaje <span className="text-red-500">*</span>
          </label>
          <textarea
            value={formData.body}
            onChange={(e) => setFormData({ ...formData, body: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none"
            placeholder="Ej: El sistema estará en mantenimiento hoy de 8pm a 10pm. Gracias por su comprensión."
            rows={4}
            maxLength={500}
            disabled={loading}
          />
          <p className="text-xs text-gray-500 mt-1">
            {formData.body.length}/500 caracteres
          </p>
        </div>

        {/* Target */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Destinatarios
          </label>
          <div className="flex gap-4">
            <label className="flex items-center">
              <input
                type="radio"
                value="all"
                checked={formData.target === 'all'}
                onChange={(e) => setFormData({ ...formData, target: e.target.value as 'all' | 'specific' })}
                className="mr-2"
                disabled={loading}
              />
              <span className="text-sm">Todos los usuarios</span>
            </label>
            <label className="flex items-center">
              <input
                type="radio"
                value="specific"
                checked={formData.target === 'specific'}
                onChange={(e) => setFormData({ ...formData, target: e.target.value as 'all' | 'specific' })}
                className="mr-2"
                disabled={loading}
              />
              <span className="text-sm">Usuarios específicos (próximamente)</span>
            </label>
          </div>
        </div>

        {/* Botón de envío */}
        <button
          type="submit"
          disabled={loading || !formData.title.trim() || !formData.body.trim()}
          className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              Enviando...
            </>
          ) : (
            <>
              <Send className="w-4 h-4" />
              Enviar Notificación
            </>
          )}
        </button>
      </form>

      {/* Resultado */}
      {sentCount !== null && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center gap-2 text-green-700">
            <CheckCircle className="w-5 h-5" />
            <span className="font-medium">¡Notificación enviada!</span>
          </div>
          <p className="text-sm text-green-600 mt-1">
            Se envió exitosamente a {sentCount} usuarios.
          </p>
        </div>
      )}

      {/* Alerta informativa */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-blue-600 mt-0.5" />
          <div className="text-sm text-blue-700">
            <p className="font-medium mb-1">Nota importante:</p>
            <ul className="list-disc list-inside space-y-1 text-xs">
              <li>Las notificaciones solo llegan a usuarios que han aceptado recibir push notifications</li>
              <li>Los usuarios deben tener la app instalada en su dispositivo</li>
              <li>El envío puede tardar unos minutos dependingiendo de la cantidad de usuarios</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

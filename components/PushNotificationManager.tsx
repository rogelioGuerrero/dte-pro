import React, { useEffect, useState } from 'react';
import { Bell, BellOff, X } from 'lucide-react';

interface PushNotificationManagerProps {
  className?: string;
}

export const PushNotificationManager: React.FC<PushNotificationManagerProps> = ({ 
  className = '' 
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>('default');

  useEffect(() => {
    checkSupport();
    
    // Escuchar eventos del service worker para mostrar notificaciones en la UI
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data?.type === 'PUSH_NOTIFICATION') {
          // Aquí podrías mostrar un toast o banner personalizado
          console.log('Push notification recibida:', event.data.payload);
        }
      });
    }
  }, []);

  const checkSupport = () => {
    const supported = 'serviceWorker' in navigator && 'PushManager' in window;
    setIsSupported(supported);
    setPermission(Notification.permission);
    
    // Mostrar banner si está soportado y no tiene permiso
    if (supported && Notification.permission === 'default') {
      // Mostrar después de 3 segundos para no interrumpir la carga
      setTimeout(() => setIsVisible(true), 3000);
    }
  };

  const requestPermission = async () => {
    try {
      const permission = await Notification.requestPermission();
      setPermission(permission);
      
      if (permission === 'granted') {
        // Disparar evento para que el hook principal se suscriba
        window.dispatchEvent(new CustomEvent('push-permission-granted'));
        setIsVisible(false);
      }
    } catch (error) {
      console.error('Error requesting notification permission:', error);
    }
  };

  const dismiss = () => {
    setIsVisible(false);
    localStorage.setItem('push-notification-dismissed', 'true');
  };

  // No mostrar si ya fue descartado o si ya tiene permiso
  if (!isVisible || !isSupported || permission !== 'default') {
    return null;
  }

  return (
    <div className={`fixed bottom-4 right-4 z-50 max-w-sm ${className}`}>
      <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-blue-600" />
            <div>
              <h3 className="font-semibold text-gray-900 text-sm">Notificaciones</h3>
              <p className="text-xs text-gray-600">Recibe alertas importantes</p>
            </div>
          </div>
          <button
            onClick={dismiss}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        
        <p className="text-sm text-gray-700 mb-3">
          Activa las notificaciones para recibir mensajes importantes sobre mantenimiento, 
          actualizaciones y alertas del sistema.
        </p>
        
        <div className="flex gap-2">
          <button
            onClick={requestPermission}
            className="flex-1 bg-blue-600 text-white px-3 py-2 rounded-md text-sm font-medium hover:bg-blue-700 transition-colors flex items-center justify-center gap-1"
          >
            <Bell className="w-4 h-4" />
            Activar
          </button>
          <button
            onClick={dismiss}
            className="flex-1 bg-gray-100 text-gray-700 px-3 py-2 rounded-md text-sm font-medium hover:bg-gray-200 transition-colors flex items-center justify-center gap-1"
          >
            <BellOff className="w-4 h-4" />
            Ahora no
          </button>
        </div>
      </div>
    </div>
  );
};

export default PushNotificationManager;

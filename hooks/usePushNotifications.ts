import { useEffect, useState } from 'react';

interface PushSubscription {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

export const usePushNotifications = () => {
  const [subscription, setSubscription] = useState<PushSubscription | null>(null);
  const [isSupported, setIsSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [isSubscribing, setIsSubscribing] = useState(false);

  useEffect(() => {
    checkSupport();

    const handlePermissionGranted = () => {
      setPermission('granted');
      subscribeToPush();
    };

    window.addEventListener('push-permission-granted', handlePermissionGranted);

    return () => {
      window.removeEventListener('push-permission-granted', handlePermissionGranted);
    };
  }, []);

  const checkSupport = () => {
    const supported = 'serviceWorker' in navigator && 'PushManager' in window;
    setIsSupported(supported);

    if (supported) {
      setPermission(Notification.permission);
    }
  };

  const requestPermission = async (): Promise<boolean> => {
    if (!isSupported) return false;

    try {
      const permission = await Notification.requestPermission();
      setPermission(permission);
      return permission === 'granted';
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      return false;
    }
  };

  const subscribeToPush = async (): Promise<PushSubscription | null> => {
    if (!isSupported || permission !== 'granted') {
      const granted = await requestPermission();
      if (!granted) return null;
    }

    if (isSubscribing) {
      return null;
    }

    setIsSubscribing(true);

    try {
      const registration = await navigator.serviceWorker.ready;
      
      // Verificar si ya existe una suscripción antes de crear una nueva
      let pushSubscription = await registration.pushManager.getSubscription();
      
      if (!pushSubscription) {
        pushSubscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: (urlBase64ToUint8Array(
            'BKeUFT5t_y4Yb_qRcPDsRz67NqJPBBURE_mJ8RvGLg6m-NZlQMHqh7rzqRoljbKiepAsi3ht0HYBtanv_jAvsR0'
          ) as unknown) as ArrayBuffer
        });
      }

      const subscriptionData = pushSubscription.toJSON();
      setSubscription(subscriptionData as PushSubscription);

      await sendSubscriptionToBackend(subscriptionData as PushSubscription);

      return subscriptionData as PushSubscription;
    } catch (error) {
      console.error('Error subscribing to push notifications:', error);
      return null;
    } finally {
      setIsSubscribing(false);
    }
  };

  const sendSubscriptionToBackend = async (subscription: PushSubscription) => {
    try {
      const token = localStorage.getItem('dte_token');
      const businessId = localStorage.getItem('dte_business_id');

      if (!token || !businessId) {
        return;
      }

      const apiUrl = import.meta.env.VITE_API_DTE_URL || '';
      const response = await fetch(`${apiUrl}/api/push/subscribe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'x-business-id': businessId,
        },
        body: JSON.stringify({
          subscription,
          userAgent: navigator.userAgent,
        }),
      });

      if (!response.ok) {
        throw new Error('Error suscribiéndose a push notifications');
      }
    } catch (error) {
      console.error('Error sending subscription to backend:', error);
    }
  };

  const unsubscribeFromPush = async (): Promise<boolean> => {
    if (!subscription) return true;

    try {
      const registration = await navigator.serviceWorker.ready;
      const pushSubscription = await registration.pushManager.getSubscription();

      if (pushSubscription) {
        await pushSubscription.unsubscribe();

        const token = localStorage.getItem('dte_token');
        const businessId = localStorage.getItem('dte_business_id');

        if (token && businessId) {
          const apiUrl = import.meta.env.VITE_API_DTE_URL || '';
          await fetch(`${apiUrl}/api/push/unsubscribe`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`,
              'x-business-id': businessId,
            },
            body: JSON.stringify({
              endpoint: subscription.endpoint,
            }),
          });
        }
      }

      setSubscription(null);
      return true;
    } catch (error) {
      console.error('Error unsubscribing from push notifications:', error);
      return false;
    }
  };

  return {
    isSupported,
    permission,
    subscription,
    requestPermission,
    subscribeToPush,
    unsubscribeFromPush,
  };
};

export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

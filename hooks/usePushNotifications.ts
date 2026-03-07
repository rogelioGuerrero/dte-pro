import { useEffect, useMemo, useState } from 'react';
import { useEmisor } from '../contexts/EmisorContext';
import { apiFetch } from '../utils/apiClient';

interface PushSubscription {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

export const usePushNotifications = () => {
  const { businessId } = useEmisor();
  const [subscription, setSubscription] = useState<PushSubscription | null>(null);
  const [isSupported, setIsSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [isSubscribing, setIsSubscribing] = useState(false);
  const storageKey = useMemo(() => `dte_push_subscription:${businessId || 'anonymous'}`, [businessId]);

  useEffect(() => {
    checkSupport();

    if (typeof window !== 'undefined') {
      const stored = window.localStorage.getItem(storageKey);
      if (stored) {
        try {
          setSubscription(JSON.parse(stored) as PushSubscription);
        } catch (error) {
          console.error('Error parsing stored push subscription:', error);
          window.localStorage.removeItem(storageKey);
        }
      }
    }

    const handlePermissionGranted = () => {
      setPermission('granted');
      subscribeToPush();
    };

    window.addEventListener('push-permission-granted', handlePermissionGranted);

    return () => {
      window.removeEventListener('push-permission-granted', handlePermissionGranted);
    };
  }, [storageKey]);

  useEffect(() => {
    if (!isSupported) return;

    const loadExistingSubscription = async () => {
      try {
        const registration = await navigator.serviceWorker.ready;
        const existing = await registration.pushManager.getSubscription();
        if (!existing) return;
        const existingData = existing.toJSON() as PushSubscription;
        setSubscription(existingData);
        window.localStorage.setItem(storageKey, JSON.stringify(existingData));
      } catch (error) {
        console.error('Error loading existing push subscription:', error);
      }
    };

    loadExistingSubscription();
  }, [isSupported, storageKey]);

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
      window.localStorage.setItem(storageKey, JSON.stringify(subscriptionData));

      await sendSubscriptionToBackend(subscriptionData as PushSubscription);

      return subscriptionData as PushSubscription;
    } catch (error) {
      console.error('Error subscribing to push notifications:', error);
      return null;
    } finally {
      setIsSubscribing(false);
    }
  };

  const sendSubscriptionToBackend = async (nextSubscription: PushSubscription) => {
    if (!businessId) {
      return;
    }

    await apiFetch('/api/business/push-subscriptions', {
      method: 'POST',
      body: {
        businessId,
        subscription: nextSubscription,
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
      },
    });
  };

  const unsubscribeFromPush = async (): Promise<boolean> => {
    if (!subscription) return true;

    try {
      const registration = await navigator.serviceWorker.ready;
      const pushSubscription = await registration.pushManager.getSubscription();

      if (pushSubscription) {
        await pushSubscription.unsubscribe();
      }

      setSubscription(null);
      window.localStorage.removeItem(storageKey);

      if (businessId) {
        await apiFetch('/api/business/push-subscriptions', {
          method: 'DELETE',
          body: {
            businessId,
            endpoint: subscription?.endpoint || null,
          },
        });
      }

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

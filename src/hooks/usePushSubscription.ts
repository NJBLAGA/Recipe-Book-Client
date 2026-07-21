import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { api } from '@/lib/api';

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

function arrayBufferToBase64(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}

export function usePushSubscription() {
  const [permission, setPermission] = useState<NotificationPermission>(
    typeof Notification !== 'undefined' ? Notification.permission : 'default',
  );
  const [isSubscribed, setIsSubscribed] = useState(false);

  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
    navigator.serviceWorker.ready
      .then(async (reg) => {
        const sub = await reg.pushManager.getSubscription();
        setIsSubscribed(!!sub && Notification.permission === 'granted');
      })
      .catch(() => {});
  }, []);

  const subscribe = useCallback(async (): Promise<boolean> => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      toast.error('Push notifications are not supported in this browser');
      return false;
    }

    const perm = await Notification.requestPermission();
    setPermission(perm);
    if (perm !== 'granted') return false;

    try {
      const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('SW not ready')), 5000),
      );
      const reg = await Promise.race([navigator.serviceWorker.ready, timeout]);
      const { publicKey } = await api.get<{ publicKey: string }>('/api/push/vapid-public-key');
      if (!publicKey) return false;

      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey),
        });
      }

      const p256dh = sub.getKey('p256dh');
      const auth = sub.getKey('auth');
      if (!p256dh || !auth) return false;

      await api.post('/api/push/subscribe', {
        endpoint: sub.endpoint,
        keys: {
          p256dh: arrayBufferToBase64(p256dh),
          auth: arrayBufferToBase64(auth),
        },
      });

      setIsSubscribed(true);
      return true;
    } catch (e) {
      const msg = e instanceof Error ? e.message : '';
      if (msg === 'SW not ready') {
        toast.error('Push notifications require the installed app — add to your home screen first');
      } else {
        toast.error('Failed to enable notifications');
      }
      return false;
    }
  }, []);

  return { permission, isSubscribed, subscribe };
}

import React, { useEffect } from 'react';
import { ToastContainer, useToast } from './Toast';
import type { ToastType } from './Toast';

const GlobalToastHost: React.FC = () => {
  const { toasts, addToast, removeToast } = useToast();

  useEffect(() => {
    const handler = (event: Event) => {
      const custom = event as CustomEvent<{ message: string; type: ToastType }>;
      if (!custom.detail?.message) return;
      addToast(custom.detail.message, custom.detail.type);
    };

    window.addEventListener('global-toast', handler);
    return () => window.removeEventListener('global-toast', handler);
  }, [addToast]);

  return (
    <ToastContainer
      toasts={toasts}
      removeToast={removeToast}
      className="fixed top-6 right-6 flex flex-col gap-2"
      style={{ zIndex: 9999 }}
    />
  );
};

export default GlobalToastHost;

export type GlobalToastType = 'success' | 'error' | 'info';

export const emitGlobalToast = (message: string, type: GlobalToastType = 'info') => {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('global-toast', { detail: { message, type } }));
};

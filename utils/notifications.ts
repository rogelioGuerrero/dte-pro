export const notify = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('global-toast', {
      detail: { message, type }
    }));
  }
};

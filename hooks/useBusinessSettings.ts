import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BusinessSettings,
  DEFAULT_BUSINESS_SETTINGS,
  getDefaultActiveTab,
  normalizeBusinessSettings,
  resolveBusinessSettings,
  saveBusinessSettingsToStorage,
} from '../utils/businessSettings';
import { AppTab } from '../utils/appTabs';

export function useBusinessSettings(businessId: string | null) {
  const [settings, setSettings] = useState<BusinessSettings>(() => normalizeBusinessSettings({
    ...DEFAULT_BUSINESS_SETTINGS,
    businessId,
  }));
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const resolved = await resolveBusinessSettings(businessId);
      setSettings(resolved);
    } finally {
      setLoading(false);
    }
  }, [businessId]);

  useEffect(() => {
    reload();
  }, [reload]);

  const updateLocalSettings = useCallback((updater: (current: BusinessSettings) => BusinessSettings) => {
    setSettings((current) => {
      const next = normalizeBusinessSettings(updater(current));
      saveBusinessSettingsToStorage(next);
      return next;
    });
  }, []);

  const defaultTab = useMemo<AppTab>(() => getDefaultActiveTab(settings), [settings]);

  return {
    settings,
    loading,
    defaultTab,
    reload,
    updateLocalSettings,
  };
}

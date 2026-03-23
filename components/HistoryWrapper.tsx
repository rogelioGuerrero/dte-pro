import React from 'react';
import { BACKEND_CONFIG } from '../utils/backendConfig';
import DTEDashboard from './DTEDashboard';
import DTEDashboardBackend from './DTEDashboardBackend';

// Componente que decide dinámicamente qué versión del historial usar
const HistoryWrapper: React.FC = () => {
  // Si la variable de entorno VITE_USE_BACKEND_HISTORY está en true, usa el backend
  // Si no, usa la versión local
  return BACKEND_CONFIG.USE_BACKEND_HISTORY ? <DTEDashboardBackend /> : <DTEDashboard />;
};

export default HistoryWrapper;

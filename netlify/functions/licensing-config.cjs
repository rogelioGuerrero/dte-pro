const crypto = require('crypto');

// Endpoint para verificar configuración de licenciamiento
exports.handler = async function(event, context) {
  try {
    // Verificar si el licenciamiento está activado via variable de entorno
    const licensingEnabled = process.env.LICENSING_ENABLED === 'true';
    const announcement = process.env.LICENSING_ANNOUNCEMENT || '';
    const forceUserMode = process.env.FORCE_USER_MODE === 'true';
    const minVersion = process.env.MIN_APP_VERSION || '';
    const maintenanceMode = process.env.MAINTENANCE_MODE === 'true';
    const maintenanceMessage = process.env.MAINTENANCE_MESSAGE || 'La aplicación está en mantenimiento. Por favor intenta más tarde.';
    const dailyExportLimit = parseInt(process.env.DAILY_EXPORT_LIMIT || '5');

    const response = {
      enabled: licensingEnabled,
      announcement: licensingEnabled ? announcement : undefined,
      forceUserModeSelection: licensingEnabled ? forceUserMode : false,
      minVersion: minVersion || undefined,
      maintenanceMode,
      maintenanceMessage: maintenanceMode ? maintenanceMessage : undefined,
      dailyExportLimit: licensingEnabled ? dailyExportLimit : undefined
    };

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=300', // 5 minutos
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET'
      },
      body: JSON.stringify(response)
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' })
    };
  }
};

export const CONFIGURATION_UNAVAILABLE = 'La exportación e importación de configuraciones necesita una actualización del servidor. Contacta al administrador para habilitarla.';
export function isConfigurationUnavailable(error: {code?: string; message?: string}): boolean {
  return (error.code === 'PGRST202' && /configuration_(export|import)/i.test(error.message || '')) ||
    /Could not find the function public\.configuration_(export|import)/i.test(error.message || '');
}

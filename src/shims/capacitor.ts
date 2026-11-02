// Remplaçant « web » des modules Capacitor, utilisé UNIQUEMENT quand ils ne sont pas installés
// (aperçu local). Dans l'APK et sur le site compilé par GitHub, les vrais modules sont utilisés.
export const Capacitor = { isNativePlatform: () => false, getPlatform: () => 'web' };
const notAvailable = async () => { throw new Error('Indisponible dans cette version.'); };
export const LocalNotifications = {
  checkPermissions: async () => ({ display: 'denied' }),
  requestPermissions: async () => ({ display: 'denied' }),
  createChannel: notAvailable, getPending: async () => ({ notifications: [] }), cancel: notAvailable, schedule: notAvailable,
  addListener: async () => ({ remove: async () => {} }),
};
export const Filesystem = { writeFile: notAvailable };
export const Directory = { Cache: 'CACHE', Documents: 'DOCUMENTS' };
export const Encoding = { UTF8: 'utf8' };
export const Share = { share: notAvailable };

// Remplaçant « web » des modules Capacitor, utilisé UNIQUEMENT quand ils ne sont pas installés
// (aperçu local). Dans l'APK et sur le site compilé par GitHub, les vrais modules sont utilisés.
export const Capacitor = { isNativePlatform: () => false, getPlatform: () => 'web' };
const notAvailable = async () => { throw new Error('Indisponible dans cette version.'); };
export const LocalNotifications = {
  checkPermissions: async () => ({ display: 'denied' }),
  requestPermissions: async () => ({ display: 'denied' }),
  createChannel: notAvailable, getPending: async () => ({ notifications: [] }), cancel: notAvailable, schedule: notAvailable,
  addListener: async () => ({ remove: async () => {} }),
  registerActionTypes: async () => {},
};
export const Filesystem = { writeFile: notAvailable, readFile: notAvailable, deleteFile: notAvailable };
export const Directory = { Cache: 'CACHE', Documents: 'DOCUMENTS' };
export const Encoding = { UTF8: 'utf8' };
export const Share = { share: notAvailable };
export const TextZoom = { getPreferred: async () => ({ value: 1 }), get: async () => ({ value: 1 }), set: async () => {} };
export const App = { addListener: async (_e: string, _h: () => void) => ({ remove: async () => {} }), exitApp: async () => {}, minimizeApp: async () => {} };
export const BiometricAuth = { checkBiometry: async () => ({ isAvailable: false, strongBiometryIsAvailable: false }), authenticate: notAvailable };

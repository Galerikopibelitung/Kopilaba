import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'id.kopilaba.app',
  appName: 'KopiLaba',
  webDir: 'dist',
  bundledWebRuntime: false,
  android: { allowMixedContent: false },
  server: { androidScheme: 'https' },
};
export default config;

import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.barbershop.app',
  appName: 'Barber Shop',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
};

export default config;


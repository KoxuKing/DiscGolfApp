import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.local.discgolftraining',
  appName: 'Disc Golf Training',
  webDir: 'dist',
  server: {
    hostname: 'disc-golf-training',
    androidScheme: 'https',
  },
};

export default config;

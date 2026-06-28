import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.bula.cyberhunt',
  appName: 'JobHunt',
  webDir: 'build',
  server: {
    allowNavigation: [
      'remotive.com',
      'www.arbeitnow.com',
      'www.themuse.com',
      'cyberhunt-taupe.vercel.app',
    ],
  },
  plugins: {
    BackgroundRunner: {
      label: 'com.bula.cyberhunt.check',
      src: 'background.js',
      event: 'jobSearch',
      repeat: true,
      interval: 30,
      autoStart: true,
    },
    LocalNotifications: {
      smallIcon: 'ic_launcher_foreground',
      iconColor: '#00FFA3',
    },
  },
};

export default config;

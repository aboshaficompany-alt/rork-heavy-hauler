import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.amas.logistics',
  appName: 'rork-heavy-hauler',
  webDir: 'dist',
  server: {
    url: 'https://287ebe98-47d5-49c0-b0be-9d67d48758fd.lovableproject.com?forceHideBadge=true',
    cleartext: true
  }
};

export default config;

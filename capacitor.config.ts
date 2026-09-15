import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'io.github.astrays.amethyst',
  appName: 'Amethyst',
  webDir: 'dist',
  // Capacitor's default ("debug") logs every plugin call's full arguments - including
  // syncRules' complete package/domain/rule payload - at V level in debug builds.
  // docs/SECURITY_MODEL.md prohibits logging active block rules unconditionally.
  loggingBehavior: 'none'
};

export default config;

import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * Apenas valores PÚBLICOS entram aqui. Tudo que está no bundle do app pode ser
 * lido por qualquer pessoa: segredos vivem somente na API.
 */
const IS_PROD = process.env.APP_VARIANT === 'production';
const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3333';

if (IS_PROD && !API_URL.startsWith('https://')) {
  throw new Error('EXPO_PUBLIC_API_URL precisa ser https em builds de produção');
}

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'SupplySync',
  slug: 'supplysync',
  scheme: 'supplysync',
  version: '1.0.0',
  orientation: 'portrait',
  userInterfaceStyle: 'light',
  icon: './assets/icon.png',
  backgroundColor: '#F7F8F5',
  ios: {
    bundleIdentifier: 'app.supplysync.mobile',
    supportsTablet: false,
    config: { usesNonExemptEncryption: false },
    infoPlist: {
      NSCameraUsageDescription: 'Para você fotografar um item que acabou e mostrar para a casa.',
      NSPhotoLibraryUsageDescription: 'Para anexar a foto de um item que acabou.',
    },
    privacyManifests: {
      NSPrivacyAccessedAPITypes: [
        { NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategoryUserDefaults', NSPrivacyAccessedAPITypeReasons: ['CA92.1'] },
      ],
    },
  },
  android: {
    package: 'app.supplysync.mobile',
    adaptiveIcon: { foregroundImage: './assets/adaptive-icon.png', backgroundColor: '#2F7A55' },
    // Backup do Android copiaria dados locais para a nuvem do Google: desativado.
    allowBackup: false,
    blockedPermissions: ['android.permission.RECORD_AUDIO', 'android.permission.READ_CONTACTS'],
  },
  plugins: [
    'expo-router',
    'expo-secure-store',
    'expo-font',
    ['expo-splash-screen', { image: './assets/splash-icon.png', imageWidth: 120, backgroundColor: '#F7F8F5' }],
    ['expo-notifications', { color: '#2F7A55' }],
    [
      'expo-image-picker',
      {
        photosPermission: 'Para anexar a foto de um item que acabou.',
        cameraPermission: 'Para você fotografar um item que acabou e mostrar para a casa.',
        microphonePermission: false,
      },
    ],
  ],
  experiments: { typedRoutes: true },
  extra: {
    apiUrl: API_URL,
    turnstileSiteKey: process.env.EXPO_PUBLIC_TURNSTILE_SITE_KEY ?? null,
    turnstileBaseUrl: process.env.EXPO_PUBLIC_TURNSTILE_BASE_URL ?? null,
    eas: { projectId: process.env.EAS_PROJECT_ID },
  },
});

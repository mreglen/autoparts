import Constants from 'expo-constants';
import * as Device from 'expo-device';
import { Platform } from 'react-native';

import { API_BASE_URL } from '../config/env';

export const APP_VERSION: string = Constants.expoConfig?.version ?? '0.0.0';

const PLATFORMS = new Set(['ios', 'android', 'web']);

export const APP_PLATFORM: string = PLATFORMS.has(Platform.OS) ? Platform.OS : 'unknown';

export const APP_HEADERS: Record<string, string> = {
  'X-App-Version': APP_VERSION,
  'X-App-Platform': APP_PLATFORM,
};

export function deviceInfo(): string {
  const model = Device.modelName || 'unknown';
  const os = `${Platform.OS} ${String(Platform.Version)}`;
  return `${model} · ${os} · app ${APP_VERSION} · ${API_BASE_URL}`;
}

import * as SecureStore from 'expo-secure-store';

import { TOKEN_KEYS } from '../storage/keys';

export interface StoredTokens {
  access: string | null;
  refresh: string | null;
}

export async function readTokens(): Promise<StoredTokens> {
  const [access, refresh] = await Promise.all([
    SecureStore.getItemAsync(TOKEN_KEYS.access),
    SecureStore.getItemAsync(TOKEN_KEYS.refresh),
  ]);
  return { access, refresh };
}

export async function saveTokens(tokens: Partial<StoredTokens>): Promise<void> {
  const jobs: Array<Promise<unknown>> = [];
  if ('access' in tokens) jobs.push(setOrDelete(TOKEN_KEYS.access, tokens.access));
  if ('refresh' in tokens) jobs.push(setOrDelete(TOKEN_KEYS.refresh, tokens.refresh));
  await Promise.all(jobs);
}

async function setOrDelete(key: string, value: string | null): Promise<void> {
  return value ? SecureStore.setItemAsync(key, value) : SecureStore.deleteItemAsync(key);
}

export async function clearTokens(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(TOKEN_KEYS.access),
    SecureStore.deleteItemAsync(TOKEN_KEYS.refresh),
  ]);
}

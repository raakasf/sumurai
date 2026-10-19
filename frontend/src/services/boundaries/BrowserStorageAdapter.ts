import type { IStorageAdapter } from './IStorageAdapter';

export class BrowserStorageAdapter implements IStorageAdapter {
  getItem(key: string): string | null {
    if (typeof window === 'undefined') return null;
    const sessionVal = window.sessionStorage?.getItem(key);
    if (sessionVal !== null && sessionVal !== undefined) {
      return sessionVal;
    }
    const localVal = window.localStorage?.getItem(key);
    if (localVal !== null && localVal !== undefined) {
      window.sessionStorage?.setItem(key, localVal);
      return localVal;
    }
    return null;
  }

  setItem(key: string, value: string): void {
    if (typeof window === 'undefined') return;
    window.sessionStorage?.setItem(key, value);
    const isRememberMe = window.localStorage?.getItem('sumurai_remember_me') === 'true';
    if (isRememberMe) {
      window.localStorage?.setItem(key, value);
    }
  }

  removeItem(key: string): void {
    if (typeof window === 'undefined') return;
    window.sessionStorage?.removeItem(key);
    window.localStorage?.removeItem(key);
  }

  clear(): void {
    if (typeof window === 'undefined') return;
    window.sessionStorage?.clear();
    window.localStorage?.removeItem('auth_token');
    window.localStorage?.removeItem('refresh_token');
    window.localStorage?.removeItem('sumurai_remember_me');
  }
}

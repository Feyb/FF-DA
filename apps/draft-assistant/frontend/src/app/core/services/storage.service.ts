import { Injectable } from '@angular/core';

/**
 * Thin wrapper around localStorage that silently swallows quota/security errors
 * and handles JSON serialisation / deserialisation.
 */
@Injectable({ providedIn: 'root' })
export class StorageService {
  getItem<T>(key: string): T | null {
    try {
      const raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : null;
    } catch {
      return null;
    }
  }

  getRawItem(key: string): string | null {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  }

  setItem(key: string, value: unknown): void {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // ignore localStorage errors (private mode, quota exceeded, etc.)
    }
  }

  setRawItem(key: string, value: string): void {
    try {
      localStorage.setItem(key, value);
    } catch {
      // ignore localStorage errors
    }
  }

  removeItem(key: string): void {
    try {
      localStorage.removeItem(key);
    } catch {
      // ignore localStorage errors
    }
  }
}

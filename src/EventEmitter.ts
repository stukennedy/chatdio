/**
 * Simple typed event emitter for cross-browser compatibility
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export class TypedEventEmitter<
  T extends Record<string, (...args: any[]) => void>
> {
  private listeners: Map<keyof T, Set<T[keyof T]>> = new Map();

  on<K extends keyof T>(event: K, listener: T[K]): this {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(listener as T[keyof T]);
    return this;
  }

  off<K extends keyof T>(event: K, listener: T[K]): this {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      eventListeners.delete(listener as T[keyof T]);
    }
    return this;
  }

  once<K extends keyof T>(event: K, listener: T[K]): this {
    const onceListener = ((...args: Parameters<T[K]>) => {
      this.off(event, onceListener as T[K]);
      (listener as (...args: Parameters<T[K]>) => void)(...args);
    }) as T[K];
    return this.on(event, onceListener);
  }

  emit<K extends keyof T>(event: K, ...args: Parameters<T[K]>): boolean {
    const eventListeners = this.listeners.get(event);
    if (!eventListeners || eventListeners.size === 0) {
      return false;
    }
    eventListeners.forEach((listener) => {
      try {
        (listener as (...args: Parameters<T[K]>) => void)(...args);
      } catch (error) {
        console.error(`Error in event listener for ${String(event)}:`, error);
      }
    });
    return true;
  }

  removeAllListeners(event?: keyof T): this {
    if (event) {
      this.listeners.delete(event);
    } else {
      this.listeners.clear();
    }
    return this;
  }

  listenerCount(event: keyof T): number {
    return this.listeners.get(event)?.size ?? 0;
  }
}

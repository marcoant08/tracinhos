import Redis from "ioredis";

type MessageHandler = (channel: string, message: string) => void;

export type Store = {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSeconds: number): Promise<void>;
  setNxPx(key: string, value: string, pxMs: number): Promise<boolean>;
  del(key: string): Promise<void>;
  publish(channel: string, message: string): Promise<void>;
  subscribe(channel: string, handler: MessageHandler): Promise<() => Promise<void>>;
};

class MemoryStore implements Store {
  private data = new Map<string, { value: string; expires: number | null }>();
  private subs = new Map<string, Set<MessageHandler>>();

  private read(key: string): string | null {
    const row = this.data.get(key);
    if (!row) return null;
    if (row.expires && row.expires < Date.now()) {
      this.data.delete(key);
      return null;
    }
    return row.value;
  }

  async get(key: string) {
    return this.read(key);
  }

  async set(key: string, value: string, ttlSeconds: number) {
    this.data.set(key, { value, expires: Date.now() + ttlSeconds * 1000 });
  }

  async setNxPx(key: string, value: string, pxMs: number) {
    if (this.read(key) !== null) return false;
    this.data.set(key, { value, expires: Date.now() + pxMs });
    return true;
  }

  async del(key: string) {
    this.data.delete(key);
  }

  async publish(channel: string, message: string) {
    for (const handler of this.subs.get(channel) ?? []) handler(channel, message);
  }

  async subscribe(channel: string, handler: MessageHandler) {
    const set = this.subs.get(channel) ?? new Set();
    set.add(handler);
    this.subs.set(channel, set);
    return async () => {
      set.delete(handler);
    };
  }
}

class RedisStore implements Store {
  private pub: Redis;
  private sub: Redis;

  constructor(url: string) {
    this.pub = new Redis(url, { maxRetriesPerRequest: 3, lazyConnect: false });
    this.sub = new Redis(url, { maxRetriesPerRequest: null, lazyConnect: false });
  }

  async get(key: string) {
    return this.pub.get(key);
  }

  async set(key: string, value: string, ttlSeconds: number) {
    await this.pub.set(key, value, "EX", ttlSeconds);
  }

  async setNxPx(key: string, value: string, pxMs: number) {
    const result = await this.pub.set(key, value, "PX", pxMs, "NX");
    return result === "OK";
  }

  async del(key: string) {
    await this.pub.del(key);
  }

  async publish(channel: string, message: string) {
    await this.pub.publish(channel, message);
  }

  async subscribe(channel: string, handler: MessageHandler) {
    await this.sub.subscribe(channel);
    const listener = (ch: string, message: string) => {
      if (ch === channel) handler(ch, message);
    };
    this.sub.on("message", listener);
    return async () => {
      this.sub.off("message", listener);
      await this.sub.unsubscribe(channel);
    };
  }
}

const globalStore = globalThis as typeof globalThis & { __tracinhosStore?: Store };

export function getStore(): Store {
  if (globalStore.__tracinhosStore) return globalStore.__tracinhosStore;
  const url = process.env.REDIS_URL;
  globalStore.__tracinhosStore = url ? new RedisStore(url) : new MemoryStore();
  return globalStore.__tracinhosStore;
}

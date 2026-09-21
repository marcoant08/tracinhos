import { Redis } from "@upstash/redis";

type MessageHandler = (channel: string, message: string) => void;

export type Store = {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSeconds: number): Promise<void>;
  setNxPx(key: string, value: string, pxMs: number): Promise<boolean>;
  del(key: string): Promise<void>;
  publish(channel: string, message: string): Promise<void>;
  subscribe(channel: string, handler: MessageHandler): Promise<() => Promise<void>>;
};

function asString(value: unknown): string | null {
  if (value == null) return null;
  return typeof value === "string" ? value : JSON.stringify(value);
}

class MemoryStore implements Store {
  private data = new Map<string, { value: string; expires: number | null }>();

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
    emit(channel, message);
  }

  async subscribe(channel: string, handler: MessageHandler) {
    return addSub(channel, handler);
  }
}

class UpstashStore implements Store {
  private redis: Redis;

  constructor(url: string, token: string) {
    this.redis = new Redis({ url, token, automaticDeserialization: false });
  }

  async get(key: string) {
    return asString(await this.redis.get<string>(key));
  }

  async set(key: string, value: string, ttlSeconds: number) {
    await this.redis.set(key, value, { ex: ttlSeconds });
  }

  async setNxPx(key: string, value: string, pxMs: number) {
    const result = await this.redis.set(key, value, { px: pxMs, nx: true });
    return result === "OK" || Boolean(result);
  }

  async del(key: string) {
    await this.redis.del(key);
  }

  async publish(channel: string, message: string) {
    emit(channel, message);
  }

  async subscribe(channel: string, handler: MessageHandler) {
    return addSub(channel, handler);
  }
}

function getSubs() {
  const globalBus = globalThis as typeof globalThis & {
    __tracinhosSubs?: Map<string, Set<MessageHandler>>;
  };
  globalBus.__tracinhosSubs ??= new Map();
  return globalBus.__tracinhosSubs;
}

function emit(channel: string, message: string) {
  for (const handler of getSubs().get(channel) ?? []) {
    try {
      handler(channel, message);
    } catch (error) {
      console.error(error);
    }
  }
}

function addSub(channel: string, handler: MessageHandler) {
  const subs = getSubs();
  const set = subs.get(channel) ?? new Set();
  set.add(handler);
  subs.set(channel, set);
  return async () => {
    set.delete(handler);
  };
}

const globalStore = globalThis as typeof globalThis & { __tracinhosStore?: Store };

export function getStore(): Store {
  if (globalStore.__tracinhosStore) return globalStore.__tracinhosStore;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  globalStore.__tracinhosStore =
    url && token ? new UpstashStore(url, token) : new MemoryStore();
  return globalStore.__tracinhosStore;
}

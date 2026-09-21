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

class UpstashStore implements Store {
  private redis: Redis;
  private subs = new Map<string, Set<MessageHandler>>();
  private polls = new Map<string, { timer: ReturnType<typeof setInterval>; last: string | null }>();

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
    return result === "OK";
  }

  async del(key: string) {
    await this.redis.del(key);
  }

  async publish(channel: string, message: string) {
    await this.redis.set(`pubsub:${channel}`, message, { ex: 86400 });
    const poll = this.polls.get(channel);
    if (poll) poll.last = message;
    for (const handler of this.subs.get(channel) ?? []) handler(channel, message);
  }

  async subscribe(channel: string, handler: MessageHandler) {
    const set = this.subs.get(channel) ?? new Set();
    set.add(handler);
    this.subs.set(channel, set);

    if (!this.polls.has(channel)) {
      const last = asString(await this.redis.get<string>(`pubsub:${channel}`));
      const timer = setInterval(() => {
        void this.poll(channel);
      }, 400);
      this.polls.set(channel, { timer, last });
    }

    return async () => {
      set.delete(handler);
      if (set.size > 0) return;
      const poll = this.polls.get(channel);
      if (poll) clearInterval(poll.timer);
      this.polls.delete(channel);
      this.subs.delete(channel);
    };
  }

  private async poll(channel: string) {
    const state = this.polls.get(channel);
    if (!state) return;
    const value = asString(await this.redis.get<string>(`pubsub:${channel}`));
    if (value !== null && value !== state.last) {
      state.last = value;
      for (const handler of this.subs.get(channel) ?? []) handler(channel, value);
    }
  }
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

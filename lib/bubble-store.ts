import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseBrowserClient, hasSupabaseConfig } from "./supabase-client";
import type { AccountSnapshot, StorageLike } from "./account-store";
import type { BubbleEntry } from "./types";

export const BUBBLE_DURATION_MS = 24 * 60 * 60 * 1000;
export type ActiveBubble = { text: string; createdAt: number; expiresAt: number };
export type BubbleState = { active: ActiveBubble | null; archive: BubbleEntry[] };
export type BubbleStore = ReturnType<typeof createBubbleStore>;

const LOCAL_KEY = "pluoto-bubbles-v1";
type LocalRows = Record<string, BubbleState>;

function parseRows(storage: StorageLike): LocalRows {
  try { return JSON.parse(storage.getItem(LOCAL_KEY) ?? "{}") as LocalRows; } catch { return {}; }
}
function normalize(state: BubbleState | undefined, now = Date.now()): BubbleState {
  if (!state) return { active: null, archive: [] };
  if (!state.active || state.active.expiresAt > now) return { active: state.active ?? null, archive: state.archive ?? [] };
  return {
    active: null,
    archive: [{ id: crypto.randomUUID(), text: state.active.text, createdAt: state.active.createdAt, expiredAt: state.active.expiresAt, reason: "expired" }, ...(state.archive ?? [])],
  };
}

class LocalBubbleStore {
  readonly mode = "local" as const;
  private channel: BroadcastChannel | null = null;
  constructor(private storage: StorageLike, private now = () => Date.now()) {}
  private write(userId: string, state: BubbleState) {
    this.storage.setItem(LOCAL_KEY, JSON.stringify({ ...parseRows(this.storage), [userId]: state }));
    this.channel?.postMessage(userId);
  }
  async load(actor: AccountSnapshot) {
    const rows = parseRows(this.storage);
    const state = normalize(rows[actor.userId], this.now());
    if (JSON.stringify(rows[actor.userId]) !== JSON.stringify(state)) this.write(actor.userId, state);
    return state;
  }
  async publish(actor: AccountSnapshot, text: string) {
    const clean = text.trim().slice(0, 80);
    if (!clean) throw new Error("Write something before publishing.");
    const previous = await this.load(actor); const now = this.now();
    const archive = previous.active ? [{ id: crypto.randomUUID(), text: previous.active.text, createdAt: previous.active.createdAt, expiredAt: now, reason: "replaced" as const }, ...previous.archive] : previous.archive;
    const state = { active: { text: clean, createdAt: now, expiresAt: now + BUBBLE_DURATION_MS }, archive };
    this.write(actor.userId, state); return state;
  }
  async clear(actor: AccountSnapshot) {
    const previous = await this.load(actor); const now = this.now();
    const state = { active: null, archive: previous.active ? [{ id: crypto.randomUUID(), text: previous.active.text, createdAt: previous.active.createdAt, expiredAt: now, reason: "cleared" as const }, ...previous.archive] : previous.archive };
    this.write(actor.userId, state); return state;
  }
  async remove(actor: AccountSnapshot, id: string) {
    const previous=await this.load(actor);
    const state={...previous,archive:previous.archive.filter(item=>item.id!==id)};
    this.write(actor.userId,state);return state;
  }
  async clearAll(actor: AccountSnapshot) {
    const previous = await this.load(actor);
    const state: BubbleState = { active: previous.active, archive: [] };
    this.write(actor.userId, state);
    return state;
  }
  subscribe(actor: AccountSnapshot, onChange: () => void) {
    this.channel = typeof BroadcastChannel === "undefined" ? null : new BroadcastChannel(LOCAL_KEY);
    const message = (event: MessageEvent<string>) => { if (event.data === actor.userId) onChange(); };
    const storage = (event: StorageEvent) => { if (event.key === LOCAL_KEY) onChange(); };
    const focus = () => onChange();
    this.channel?.addEventListener("message", message); window.addEventListener("storage", storage); window.addEventListener("focus", focus);
    return () => { this.channel?.close(); this.channel = null; window.removeEventListener("storage", storage); window.removeEventListener("focus", focus); };
  }
}

class SupabaseBubbleStore {
  readonly mode = "supabase" as const;
  private channels: RealtimeChannel[] = [];
  constructor(private client: SupabaseClient) {}
  private async rpc<T>(name: string, args: Record<string, unknown> = {}) {
    const { data, error } = await this.client.rpc(name, args);
    if (error) throw new Error(error.message);
    return data as T;
  }
  async load(_actor: AccountSnapshot) { return this.rpc<BubbleState>("bubble_state"); }
  async publish(_actor: AccountSnapshot, text: string) { return this.rpc<BubbleState>("publish_bubble", { p_text: text.trim().slice(0, 80) }); }
  async clear(_actor: AccountSnapshot) { return this.rpc<BubbleState>("clear_bubble"); }
  async remove(_actor: AccountSnapshot, id: string) { return this.rpc<BubbleState>("delete_bubble_log",{p_id:id}); }
  async clearAll(_actor: AccountSnapshot) { return this.rpc<BubbleState>("clear_all_bubbles"); }
  subscribe(actor: AccountSnapshot, onChange: () => void) {
    this.channels = ["bubbles", "bubble_archive"].map(table => this.client.channel(`bubble:${table}:${actor.userId}`).on("postgres_changes", { event: "*", schema: "public", table, filter: `owner_id=eq.${actor.userId}` }, onChange).subscribe());
    const focus = () => onChange(); const visible = () => { if (!document.hidden) onChange(); };
    window.addEventListener("focus", focus); document.addEventListener("visibilitychange", visible);
    return () => { this.channels.forEach(channel => void this.client.removeChannel(channel)); this.channels = []; window.removeEventListener("focus", focus); document.removeEventListener("visibilitychange", visible); };
  }
}

export function createBubbleStore(storage: StorageLike = localStorage) {
  return hasSupabaseConfig() ? new SupabaseBubbleStore(getSupabaseBrowserClient()) : new LocalBubbleStore(storage);
}

import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseBrowserClient, hasSupabaseConfig } from "./supabase-client";
import type { Person } from "./types";
import { landObjectsForPerson, signCellForPerson, validateLandObjects } from "./land-objects";

export type InviteContext = { planeId?: string; inviteToken?: string; joinRequested?: boolean; friendInviteToken?: string };
export type AccountSnapshot = {
  userId: string;
  email: string;
  person: Person;
  arrangement: Array<{ personId: string; plotX: number; plotY: number }>;
  inviteContext?: InviteContext;
};
export type AccountMode = "supabase" | "local";
export type AccountIntent = "create" | "signin";
export type AccountIdentity = { userId: string; email: string };
export type AuthResult = { identity: AccountIdentity | null; existing: AccountSnapshot | null; confirmationRequired?: boolean };
export type RecoveryResult = { localToken?: string };
export type AccountErrorCode = "invalid_credentials" | "email_unconfirmed" | "email_in_use" | "password_too_short" | "rate_limited" | "network" | "no_account" | "auth_required" | "expired_link";

export class AccountError extends Error {
  constructor(public code: AccountErrorCode, message: string) { super(message); }
}

const LOCAL_ACCOUNTS = "pluoto-accounts-v1";
const LOCAL_SESSION = "pluoto-account-session-v1";
const LOCAL_CREDENTIALS = "pluoto-password-credentials-v1";
const LOCAL_RECOVERY = "pluoto-password-recovery-v1";
const PASSWORD_ITERATIONS = 120_000;
export const MIN_PASSWORD_LENGTH = 8;

type LocalCredential = { userId: string; salt: string; verifier: string };
type LocalRecovery = { email: string; token: string; expiresAt: number; used: boolean };
export type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function safeEmail(email: string) { return email.trim().toLowerCase(); }
function read<T>(storage: StorageLike, name: string, fallback: T): T {
  try { const value = storage.getItem(name); return value ? JSON.parse(value) as T : fallback; } catch { return fallback; }
}
function accountMap(storage: StorageLike) { return read<Record<string, AccountSnapshot>>(storage, LOCAL_ACCOUNTS, {}); }
function credentialMap(storage: StorageLike) { return read<Record<string, LocalCredential>>(storage, LOCAL_CREDENTIALS, {}); }
function toHex(bytes: Uint8Array) { return Array.from(bytes, byte => byte.toString(16).padStart(2, "0")).join(""); }
function fromHex(value: string) { return new Uint8Array(value.match(/.{1,2}/g)?.map(byte => Number.parseInt(byte, 16)) ?? []); }
async function passwordVerifier(password: string, salt: Uint8Array) {
  const material = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const saltBytes = new Uint8Array(salt);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: saltBytes.buffer, iterations: PASSWORD_ITERATIONS }, material, 256);
  return toHex(new Uint8Array(bits));
}
function validatePassword(password: string) {
  if (password.length < MIN_PASSWORD_LENGTH) throw new AccountError("password_too_short", `Use at least ${MIN_PASSWORD_LENGTH} characters.`);
}
function accountError(error: { message?: string; status?: number } | null | undefined, fallback: string): AccountError {
  const message = error?.message ?? fallback;
  if (/invalid login|invalid credentials/i.test(message)) return new AccountError("invalid_credentials", "That email or password isn’t correct.");
  if (/email not confirmed/i.test(message)) return new AccountError("email_unconfirmed", "Confirm your email before signing in. You can resend the confirmation below.");
  if (/already registered|already exists|user already/i.test(message)) return new AccountError("email_in_use", "That email already has a Pluoto account. Sign in or reset its password.");
  if (/password.*(short|characters)|weak password/i.test(message)) return new AccountError("password_too_short", message);
  if (error?.status === 429 || /rate limit|too many/i.test(message)) return new AccountError("rate_limited", "Please wait a moment before trying again.");
  if (/expired|invalid.*(link|token)|otp.*expired/i.test(message)) return new AccountError("expired_link", "That email link has expired or was already used. Request a new one.");
  return new AccountError("network", message || fallback);
}

export class LocalAccountStore {
  readonly mode = "local" as const;
  constructor(private storage: StorageLike, private now = () => Date.now(), private session: StorageLike = storage) {}
  async getIdentity(): Promise<AccountIdentity | null> {
    const email = this.session.getItem(LOCAL_SESSION);
    if (!email) return null;
    const account = accountMap(this.storage)[email];
    const credential = credentialMap(this.storage)[email];
    const userId = credential?.userId ?? account?.userId;
    return userId ? { userId, email } : null;
  }
  async restore() {
    const identity = await this.getIdentity();
    return identity ? accountMap(this.storage)[identity.email] ?? null : null;
  }
  async signUp(emailInput: string, password: string): Promise<AuthResult> {
    validatePassword(password);
    const email = safeEmail(emailInput);
    if (credentialMap(this.storage)[email] || accountMap(this.storage)[email]) throw new AccountError("email_in_use", "That email already has a Pluoto account. Sign in or reset its password.");
    const userId = crypto.randomUUID();
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const credential: LocalCredential = { userId, salt: toHex(salt), verifier: await passwordVerifier(password, salt) };
    this.storage.setItem(LOCAL_CREDENTIALS, JSON.stringify({ ...credentialMap(this.storage), [email]: credential }));
    this.session.setItem(LOCAL_SESSION, email);
    return { identity: { userId, email }, existing: null, confirmationRequired: false };
  }
  async signIn(emailInput: string, password: string): Promise<AuthResult> {
    const email = safeEmail(emailInput);
    const credential = credentialMap(this.storage)[email];
    if (!credential) {
      if (accountMap(this.storage)[email]) throw new AccountError("auth_required", "This earlier account needs a password. Choose Set or reset password.");
      throw new AccountError("invalid_credentials", "That email or password isn’t correct.");
    }
    const verifier = await passwordVerifier(password, fromHex(credential.salt));
    if (verifier !== credential.verifier) throw new AccountError("invalid_credentials", "That email or password isn’t correct.");
    this.session.setItem(LOCAL_SESSION, email);
    return { identity: { userId: credential.userId, email }, existing: accountMap(this.storage)[email] ?? null };
  }
  async resendConfirmation() { return; }
  async sendPasswordRecovery(emailInput: string): Promise<RecoveryResult> {
    const email = safeEmail(emailInput);
    const account = accountMap(this.storage)[email];
    const credential = credentialMap(this.storage)[email];
    if (!account && !credential) throw new AccountError("no_account", "We couldn’t find a Pluoto account for that email.");
    const token = crypto.randomUUID();
    this.storage.setItem(LOCAL_RECOVERY, JSON.stringify({ email, token, expiresAt: this.now() + 15 * 60_000, used: false } satisfies LocalRecovery));
    return { localToken: token };
  }
  async completeLocalPasswordRecovery(emailInput: string, token: string, password: string): Promise<AuthResult> {
    validatePassword(password);
    const email = safeEmail(emailInput);
    const recovery = read<LocalRecovery | null>(this.storage, LOCAL_RECOVERY, null);
    if (!recovery || recovery.email !== email || recovery.token !== token || recovery.used || recovery.expiresAt < this.now()) throw new AccountError("expired_link", "That recovery link has expired or was already used. Request a new one.");
    const accounts = accountMap(this.storage);
    const existingCredential = credentialMap(this.storage)[email];
    const userId = existingCredential?.userId ?? accounts[email]?.userId ?? crypto.randomUUID();
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const credential: LocalCredential = { userId, salt: toHex(salt), verifier: await passwordVerifier(password, salt) };
    this.storage.setItem(LOCAL_CREDENTIALS, JSON.stringify({ ...credentialMap(this.storage), [email]: credential }));
    this.storage.setItem(LOCAL_RECOVERY, JSON.stringify({ ...recovery, used: true }));
    this.session.setItem(LOCAL_SESSION, email);
    return { identity: { userId, email }, existing: accounts[email] ?? null };
  }
  async updatePassword(password: string) {
    validatePassword(password);
    const identity = await this.getIdentity();
    if (!identity) throw new AccountError("auth_required", "Open a fresh password-recovery link and try again.");
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const credential: LocalCredential = { userId: identity.userId, salt: toHex(salt), verifier: await passwordVerifier(password, salt) };
    this.storage.setItem(LOCAL_CREDENTIALS, JSON.stringify({ ...credentialMap(this.storage), [identity.email]: credential }));
  }
  async completeAuthCallback() {
    const identity = await this.getIdentity();
    if (!identity) throw new AccountError("expired_link", "That email link has expired or was already used.");
    return identity;
  }
  async save(snapshot: AccountSnapshot) {
    const email = safeEmail(snapshot.email);
    const person = { ...snapshot.person, signPosition: signCellForPerson(snapshot.person), signPositionVersion: 2 as const, landObjects: validateLandObjects(landObjectsForPerson(snapshot.person),signCellForPerson(snapshot.person)) };
    this.storage.setItem(LOCAL_ACCOUNTS, JSON.stringify({ ...accountMap(this.storage), [email]: { ...snapshot, person, email } }));
    this.session.setItem(LOCAL_SESSION, email);
  }
  async signOut() { this.session.removeItem(LOCAL_SESSION); }
}

class SupabaseAccountStore {
  readonly mode = "supabase" as const;
  constructor(private client: SupabaseClient) {}
  async getIdentity(): Promise<AccountIdentity | null> {
    const { data: { session }, error } = await this.client.auth.getSession();
    if (error) throw accountError(error, "Your session could not be restored.");
    return session?.user.email ? { userId: session.user.id, email: session.user.email } : null;
  }
  async restore(): Promise<AccountSnapshot | null> {
    const identity = await this.getIdentity();
    if (!identity) return null;
    const { data, error } = await this.client.from("profiles").select("*, character_customizations(*), lands(*), profile_pills(pill), plane_arrangements(arrangement), invitation_contexts(*)").eq("id", identity.userId).maybeSingle();
    if (error) throw new AccountError("network", error.message);
    if (!data) return null;
    const character = Array.isArray(data.character_customizations) ? data.character_customizations[0] : data.character_customizations;
    const land = Array.isArray(data.lands) ? data.lands[0] : data.lands;
    const arrangementRow = Array.isArray(data.plane_arrangements) ? data.plane_arrangements[0] : data.plane_arrangements;
    const person = { ...(land?.person_snapshot ?? {}), ...(character?.person_snapshot ?? {}), id: identity.userId, nickname: data.nickname, pills: (data.profile_pills ?? []).map((item: { pill: string }) => item.pill), owner: true } as Person;
    const invitation = Array.isArray(data.invitation_contexts) ? data.invitation_contexts[0] : data.invitation_contexts;
    return { userId: identity.userId, email: identity.email, person, arrangement: arrangementRow?.arrangement ?? [], inviteContext: invitation ? { planeId: invitation.plane_id, inviteToken: invitation.invite_token, joinRequested: Boolean(invitation.plane_id), friendInviteToken: invitation.friend_invite_token ?? undefined } : data.pending_invite ?? undefined };
  }
  async signUp(emailInput: string, password: string, redirectTo: string): Promise<AuthResult> {
    validatePassword(password);
    const email = safeEmail(emailInput);
    const { data, error } = await this.client.auth.signUp({ email, password, options: { emailRedirectTo: redirectTo } });
    if (error) throw accountError(error, "Your account could not be created.");
    if (data.user && data.user.identities?.length === 0) throw new AccountError("email_in_use", "That email already has a Pluoto account. Sign in or reset its password.");
    const identity = data.user ? { userId: data.user.id, email: data.user.email ?? email } : null;
    return { identity: data.session ? identity : null, existing: data.session ? await this.restore() : null, confirmationRequired: !data.session };
  }
  async signIn(emailInput: string, password: string): Promise<AuthResult> {
    const email = safeEmail(emailInput);
    const { data, error } = await this.client.auth.signInWithPassword({ email, password });
    if (error || !data.user) throw accountError(error, "Sign in failed.");
    const identity = { userId: data.user.id, email: data.user.email ?? email };
    return { identity, existing: await this.restore() };
  }
  async resendConfirmation(emailInput: string, redirectTo: string) {
    const { error } = await this.client.auth.resend({ type: "signup", email: safeEmail(emailInput), options: { emailRedirectTo: redirectTo } });
    if (error) throw accountError(error, "The confirmation email could not be resent.");
  }
  async sendPasswordRecovery(emailInput: string, redirectTo: string): Promise<RecoveryResult> {
    const { error } = await this.client.auth.resetPasswordForEmail(safeEmail(emailInput), { redirectTo });
    if (error) throw accountError(error, "The recovery email could not be sent.");
    return {};
  }
  async completeLocalPasswordRecovery(): Promise<AuthResult> { throw new AccountError("network", "Local recovery is unavailable while Supabase is configured."); }
  async updatePassword(password: string) {
    validatePassword(password);
    const { error } = await this.client.auth.updateUser({ password });
    if (error) throw accountError(error, "Your password could not be updated.");
  }
  async completeAuthCallback(code?: string) {
    if (code) {
      const { error } = await this.client.auth.exchangeCodeForSession(code);
      if (error) throw accountError(error, "That email link could not be completed.");
    }
    const identity = await this.getIdentity();
    if (!identity) throw new AccountError("expired_link", "That email link has expired or was already used. Request a new one.");
    return identity;
  }
  async save(snapshot: AccountSnapshot) {
    const userId = snapshot.userId;
    const normalizedPerson = { ...snapshot.person, signPosition: signCellForPerson(snapshot.person), signPositionVersion: 2 as const, landObjects: validateLandObjects(landObjectsForPerson(snapshot.person),signCellForPerson(snapshot.person)) };
    const { bubble: _bubble, bubbleCreatedAt: _bubbleCreatedAt, bubbleExpiresAt: _bubbleExpiresAt, ...persistedPerson } = normalizedPerson;
    const profile = await this.client.from("profiles").upsert({ id: userId, nickname: snapshot.person.nickname, pending_invite: snapshot.inviteContext ?? {}, updated_at: new Date().toISOString() });
    if (profile.error) throw new AccountError("network", profile.error.message);
    const operations = [
      this.client.from("character_customizations").upsert({ user_id: userId, person_snapshot: persistedPerson, updated_at: new Date().toISOString() }),
      this.client.from("lands").upsert({ owner_id: userId, ground: snapshot.person.ground === "meadow" ? "grass" : snapshot.person.ground === "clay" ? "earth" : snapshot.person.ground, home: snapshot.person.home, house_color: snapshot.person.houseColor === "rose" ? "coral" : snapshot.person.houseColor === "mint" ? "sage" : snapshot.person.houseColor, decoration_preset: snapshot.person.decorationPreset === "bare" || snapshot.person.decorationPreset === "custom" ? "garden" : snapshot.person.decorationPreset ?? "garden", person_snapshot: persistedPerson, updated_at: new Date().toISOString() }, { onConflict: "owner_id" }),
      this.client.from("plane_arrangements").upsert({ owner_id: userId, arrangement: snapshot.arrangement, updated_at: new Date().toISOString() }),
    ];
    const results = await Promise.all(operations);
    const failed = results.find(result => result.error);
    if (failed?.error) throw new AccountError("network", failed.error.message);
    const removed = await this.client.from("profile_pills").delete().eq("user_id", userId);
    if (removed.error) throw new AccountError("network", removed.error.message);
    if (snapshot.person.pills.length) {
      const added = await this.client.from("profile_pills").insert(snapshot.person.pills.map(pill => ({ user_id: userId, pill })));
      if (added.error) throw new AccountError("network", added.error.message);
    }
    if (snapshot.inviteContext?.planeId || snapshot.inviteContext?.inviteToken || snapshot.inviteContext?.friendInviteToken) {
      const invite = await this.client.from("invitation_contexts").upsert({ user_id: userId, plane_id: snapshot.inviteContext.planeId, invite_token: snapshot.inviteContext.inviteToken, friend_invite_token: snapshot.inviteContext.friendInviteToken, status: "pending", updated_at: new Date().toISOString() });
      if (invite.error) throw new AccountError("network", invite.error.message);
    }
  }
  async signOut() {
    const { error } = await this.client.auth.signOut();
    if (error) throw accountError(error, "Sign out failed.");
  }
}

export type AccountStore = LocalAccountStore | SupabaseAccountStore;
export function createAccountStore(storage: StorageLike = localStorage, session: StorageLike = sessionStorage): AccountStore {
  if (hasSupabaseConfig()) return new SupabaseAccountStore(getSupabaseBrowserClient());
  return new LocalAccountStore(storage, Date.now, session);
}

export function safeInternalReturn(candidate: string | null | undefined, fallback = "/") {
  if (!candidate || !candidate.startsWith("/") || candidate.startsWith("//") || candidate.includes("\\")) return fallback;
  try {
    const parsed = new URL(candidate, "https://pluoto.local");
    return parsed.origin === "https://pluoto.local" ? `${parsed.pathname}${parsed.search}${parsed.hash}` : fallback;
  } catch { return fallback; }
}

export function authRedirectUrl(route: "/auth/callback" | "/auth/recovery", href: string) {
  const current = new URL(href);
  const configured = process.env.NEXT_PUBLIC_APP_ORIGIN?.replace(/\/$/, "");
  const isLocal = ["localhost", "127.0.0.1"].includes(current.hostname);
  const isDeployedHttps = current.protocol === "https:" && !isLocal;
  const origin = isDeployedHttps || isLocal || !configured ? current.origin : configured;
  const next = safeInternalReturn(`${current.pathname}${current.search}${current.hash}`);
  return `${origin}${route}?next=${encodeURIComponent(next)}`;
}

export function readInviteContext(href: string): InviteContext | undefined {
  const target = new URL(href);
  const planeId = target.searchParams.get("plane") ?? undefined;
  const inviteToken = target.searchParams.get("key") ?? undefined;
  const joinRequested = target.searchParams.get("join") === "1";
  const friendInviteToken = target.searchParams.get("invite") ?? undefined;
  return planeId || inviteToken || joinRequested || friendInviteToken ? { planeId, inviteToken, joinRequested, friendInviteToken } : undefined;
}

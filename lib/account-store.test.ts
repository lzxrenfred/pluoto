import { describe, expect, it } from "vitest";
import { AccountError, authRedirectUrl, LocalAccountStore, readInviteContext, safeInternalReturn, type AccountSnapshot } from "./account-store";
import { DEMO_PEOPLE } from "./demo";

class MemoryStorage {
  private values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
  removeItem(key: string) { this.values.delete(key); }
}

describe("local password account fallback", () => {
  it("creates, saves, signs out and restores with a password", async () => {
    const storage = new MemoryStorage();
    const store = new LocalAccountStore(storage);
    const created = await store.signUp("Ren@Example.com", "a-good-password");
    expect(created.identity?.email).toBe("ren@example.com");
    const snapshot: AccountSnapshot = { userId: created.identity!.userId, email: "ren@example.com", person: DEMO_PEOPLE[0], arrangement: [{ personId: "ren", plotX: 0, plotY: 0 }] };
    await store.save(snapshot);
    await store.signOut();
    expect(await store.restore()).toBeNull();
    await expect(store.signIn("ren@example.com", "wrong-password")).rejects.toMatchObject({ code: "invalid_credentials" } satisfies Partial<AccountError>);
    expect((await store.signIn("ren@example.com", "a-good-password")).existing).toEqual(snapshot);
  });

  it("rejects duplicate emails and short passwords", async () => {
    const storage = new MemoryStorage();
    const store = new LocalAccountStore(storage);
    await expect(store.signUp("new@example.com", "short")).rejects.toMatchObject({ code: "password_too_short" } satisfies Partial<AccountError>);
    await store.signUp("new@example.com", "long-enough-password");
    await expect(store.signUp("NEW@example.com", "another-password")).rejects.toMatchObject({ code: "email_in_use" } satisfies Partial<AccountError>);
  });

  it("sets a password on a legacy OTP account without changing its id or data", async () => {
    const storage = new MemoryStorage();
    const legacy: AccountSnapshot = { userId: "legacy-user", email: "legacy@example.com", person: DEMO_PEOPLE[0], arrangement: [] };
    storage.setItem("pluoto-accounts-v1", JSON.stringify({ [legacy.email]: legacy }));
    const store = new LocalAccountStore(storage);
    await expect(store.signIn(legacy.email, "some-password")).rejects.toMatchObject({ code: "auth_required" } satisfies Partial<AccountError>);
    const recovery = await store.sendPasswordRecovery(legacy.email);
    const reset = await store.completeLocalPasswordRecovery(legacy.email, recovery.localToken!, "new-secure-password");
    expect(reset.identity?.userId).toBe(legacy.userId);
    expect(reset.existing).toEqual(legacy);
    await store.signOut();
    expect((await store.signIn(legacy.email, "new-secure-password")).existing?.userId).toBe(legacy.userId);
  });
});

describe("auth return safety", () => {
  it("preserves invitation context through a confirmation callback", () => {
    const redirect = authRedirectUrl("/auth/callback", "http://127.0.0.1:3000/?invite=friend-token&join=1");
    expect(redirect).toBe("http://127.0.0.1:3000/auth/callback?next=%2F%3Finvite%3Dfriend-token%26join%3D1");
    expect(readInviteContext("http://localhost:3000/?plane=plane-a&key=token-b&join=1&invite=friend-c")).toEqual({ planeId: "plane-a", inviteToken: "token-b", joinRequested: true, friendInviteToken: "friend-c" });
    expect(authRedirectUrl("/auth/recovery", "https://pluoto-git-auth-example.vercel.app/?invite=friend-c")).toBe("https://pluoto-git-auth-example.vercel.app/auth/recovery?next=%2F%3Finvite%3Dfriend-c");
  });

  it("rejects external and scheme-relative return destinations", () => {
    expect(safeInternalReturn("//evil.example/path")).toBe("/");
    expect(safeInternalReturn("https://evil.example/path")).toBe("/");
    expect(safeInternalReturn("/auth/../?invite=ok")).toBe("/?invite=ok");
  });
});

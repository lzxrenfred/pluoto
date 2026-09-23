"use client";

import { useEffect, useState } from "react";
import { createAccountStore, safeInternalReturn } from "@/lib/account-store";
import { BrandWordmark } from "@/components/BrandWordmark";

export default function AuthCallbackPage() {
  const [error, setError] = useState("");
  useEffect(() => {
    const url = new URL(window.location.href);
    const next = safeInternalReturn(url.searchParams.get("next"));
    const code = url.searchParams.get("code") ?? undefined;
    const authError = url.searchParams.get("error_description");
    if (authError) { setError(authError.replace(/\+/g, " ")); return; }
    const account = createAccountStore();
    void account.completeAuthCallback(code).then(() => window.location.replace(next)).catch(reason => setError(reason instanceof Error ? reason.message : "That confirmation link could not be completed."));
  }, []);
  return <main className="auth-callback-shell"><section><BrandWordmark className="auth-wordmark"/>{error ? <><p className="eyebrow">LINK UNAVAILABLE</p><h1>We couldn’t confirm that email.</h1><div className="form-error" role="alert">{error}</div><a className="primary wide" href="/">Return to sign in</a></> : <><h1>Confirming your account…</h1><p>Your Plane and invitation are still here.</p></>}</section></main>;
}

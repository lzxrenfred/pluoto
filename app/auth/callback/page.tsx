"use client";

import { useEffect, useRef, useState } from "react";
import { createAccountStore, safeInternalReturn } from "@/lib/account-store";
import { BrandWordmark } from "@/components/BrandWordmark";

export default function AuthCallbackPage() {
  const [error, setError] = useState("");
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const url = new URL(window.location.href);
    const next = safeInternalReturn(url.searchParams.get("next"));
    const code = url.searchParams.get("code") ?? undefined;
    const authError = url.searchParams.get("error_description") ?? url.searchParams.get("error");
    if (authError) { setError(authError.replace(/\+/g, " ")); return; }
    const account = createAccountStore();
    void account.completeAuthCallback(code).then(() => window.location.replace(next)).catch(reason => setError(reason instanceof Error ? reason.message : "Sign-in could not be completed."));
  }, []);
  return <main className="auth-callback-shell"><section><BrandWordmark className="auth-wordmark"/>{error ? <><p className="eyebrow">SIGN-IN UNAVAILABLE</p><h1>We couldn’t sign you in.</h1><div className="form-error" role="alert">{error}</div><a className="primary wide" href="/">Return to sign in</a></> : <><h1 className="auth-progress-title">Signing you in…</h1><p>Your Plane and invitation are still here.</p></>}</section></main>;
}

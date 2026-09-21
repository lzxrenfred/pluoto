"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Eye, EyeOff } from "lucide-react";
import { AccountError, createAccountStore, MIN_PASSWORD_LENGTH, safeInternalReturn } from "@/lib/account-store";

export default function RecoveryPage() {
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [next, setNext] = useState("/");
  useEffect(() => {
    const url = new URL(window.location.href);
    const destination = safeInternalReturn(url.searchParams.get("next"));
    const code = url.searchParams.get("code") ?? undefined;
    const authError = url.searchParams.get("error_description");
    setNext(destination);
    if (authError) { setError(authError.replace(/\+/g, " ")); return; }
    void createAccountStore().completeAuthCallback(code).then(() => setReady(true)).catch(reason => setError(reason instanceof Error ? reason.message : "That recovery link could not be completed."));
  }, []);
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setError("");
    if (password !== confirm) { setError("Those passwords don’t match."); return; }
    setBusy(true);
    try { await createAccountStore().updatePassword(password); window.location.replace(next); }
    catch (reason) { setError(reason instanceof AccountError ? reason.message : "Your password could not be updated."); }
    finally { setBusy(false); }
  };
  return <main className="auth-callback-shell"><section><strong className="auth-wordmark">pluoto</strong>{!ready && !error && <><div className="auth-spinner"/><h1>Opening recovery…</h1></>}{error && !ready && <><p className="eyebrow">LINK UNAVAILABLE</p><h1>Request a fresh recovery link.</h1><div className="form-error" role="alert">{error}</div><a className="primary wide" href="/">Return to sign in</a></>}{ready && <form onSubmit={submit}><p className="eyebrow">PASSWORD RECOVERY</p><h1>Choose a new password.</h1><p>This keeps the same Character, land, friends and Plane.</p><label className="field-label auth-field"><span>New password</span><input autoFocus type={show ? "text" : "password"} autoComplete="new-password" minLength={MIN_PASSWORD_LENGTH} required value={password} onChange={event => setPassword(event.target.value)}/><button type="button" className="password-toggle" onClick={() => setShow(value => !value)} aria-label={show ? "Hide password" : "Show password"}>{show ? <EyeOff size={17}/> : <Eye size={17}/>}</button></label><label className="field-label auth-field"><span>Confirm password</span><input type={show ? "text" : "password"} autoComplete="new-password" minLength={MIN_PASSWORD_LENGTH} required value={confirm} onChange={event => setConfirm(event.target.value)}/></label>{error && <div className="form-error" role="alert">{error}</div>}<button className="primary wide" disabled={busy || password.length < MIN_PASSWORD_LENGTH || password !== confirm}>{busy ? "Saving…" : "Save new password"}</button></form>}</section></main>;
}

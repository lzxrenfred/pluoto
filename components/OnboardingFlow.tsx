"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Check, Eye, EyeOff, Mail, RotateCcw, X } from "lucide-react";
import type { AccountIdentity, AccountIntent, AccountSnapshot, AccountStore, InviteContext } from "@/lib/account-store";
import { AccountError, authRedirectUrl, MIN_PASSWORD_LENGTH } from "@/lib/account-store";
import { ACCESSORY_COLORS, HEADWEAR, OTHER_ACCESSORIES, accessoryColorFor, applyDecorationPreset, BODY_COLORS, DECORATION_PRESETS, GROUNDS, HOMES, HOUSE_COLORS, OUTFITS, SPECIES, normalizedPerson, selectedAccessories } from "@/lib/customization";
import { PILL_GROUPS } from "@/lib/demo";
import {pillCategoryClass} from "@/lib/pills";
import type { Accessory, DecorationPreset, Person } from "@/lib/types";
import { CharacterPreview3D, LandPreview3D } from "./CustomizationPreview3D";

const DRAFT_KEY = "pluoto-onboarding-draft-v2";
const WELCOME = 0, AUTH = 1, CHECK_EMAIL = 2, NAME = 3, CHARACTER = 4, PILLS = 5, LAND = 6, RESET_PASSWORD = 7, RECOVERY_SENT = 8;
type DraftState = { version: 3; step: number; person: Person; email: string; intent: AccountIntent; inviteContext?: InviteContext };

function readDraft(owner: Person, inviteContext?: InviteContext): DraftState {
  try {
    const saved = JSON.parse(localStorage.getItem(DRAFT_KEY) ?? "null") as Partial<DraftState> | null;
    if (saved?.person) {
      const step = saved.version === 3 ? Number(saved.step ?? WELCOME) : WELCOME;
      return { version: 3, step, person: normalizedPerson(saved.person), email: saved.email ?? "", intent: saved.intent === "signin" ? "signin" : "create", inviteContext: inviteContext ? { ...saved.inviteContext, ...inviteContext } : saved.inviteContext };
    }
  } catch { /* use the supplied owner */ }
  return { version: 3, step: WELCOME, person: normalizedPerson(owner), email: "", intent: "create", inviteContext };
}

export function clearOnboardingDraft() { localStorage.removeItem(DRAFT_KEY); }

export function OnboardingFlow({ owner, people, account, inviteContext, editing = false, onComplete, onCancel }: {
  owner: Person;
  people: Person[];
  account: AccountStore;
  inviteContext?: InviteContext;
  editing?: boolean;
  onComplete: (snapshot: AccountSnapshot) => void;
  onCancel?: () => void;
}) {
  const initial = useMemo(() => editing
    ? { version: 3 as const, step: NAME, person: normalizedPerson(owner), email: "", intent: "create" as const, inviteContext }
    : readDraft(owner, inviteContext), [editing, inviteContext, owner]);
  const [step, setStep] = useState(initial.step);
  const [draft, setDraft] = useState(initial.person);
  const [email, setEmail] = useState(initial.email);
  const [intent, setIntent] = useState<AccountIntent>(initial.intent);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [identity, setIdentity] = useState<AccountIdentity | null>(null);
  const [localRecoveryToken, setLocalRecoveryToken] = useState("");
  const [error, setError] = useState("");
  const [errorCode, setErrorCode] = useState<AccountError["code"] | "">("");
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (editing) return;
    localStorage.setItem(DRAFT_KEY, JSON.stringify({ version: 3, step, person: draft, email, intent, inviteContext } satisfies DraftState));
  }, [draft, editing, email, intent, inviteContext, step]);
  useEffect(() => {
    if (!cooldown) return;
    const timer = window.setInterval(() => setCooldown(value => Math.max(0, value - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [cooldown]);
  useEffect(() => {
    if (editing) return;
    let active = true;
    void account.getIdentity().then(current => {
      if (!active || !current) return;
      setIdentity(current); setEmail(current.email);
      setStep(previous => previous < NAME || previous > LAND ? NAME : previous);
    }).catch(() => { /* account screen will surface auth errors */ });
    return () => { active = false; };
  }, [account, editing]);

  const update = (patch: Partial<Person>) => setDraft(value => normalizedPerson({ ...value, ...patch }));
  const togglePill = (pill: string) => update({ pills: draft.pills.includes(pill) ? draft.pills.filter(item => item !== pill) : [...draft.pills, pill] });
  const toggleAccessory = (item: Exclude<Accessory,"none">) => {
    const current=selectedAccessories(draft);
    const accessories=current.includes(item)?current.filter(value=>value!==item):[...current,item];
    update({accessories,accessory:accessories[0]??"none"});
  };
  const chooseHeadwear = (item: Exclude<Accessory,"none">|null) => {
    const accessories=[...selectedAccessories(draft).filter(value=>!HEADWEAR.includes(value)),...(item?[item]:[])];
    update({accessories,accessory:accessories[0]??"none"});
  };
  const setAccessoryColor = (item: Exclude<Accessory,"none">, color:string) => update({accessoryColors:{...draft.accessoryColors,[item]:color}});
  const go = (next: number) => { setError(""); setErrorCode(""); setStep(next); };
  const report = (reason: unknown, fallback: string) => {
    const accountError = reason instanceof AccountError ? reason : null;
    setErrorCode(accountError?.code ?? "network"); setError(accountError?.message ?? fallback);
  };
  const authCallback = () => authRedirectUrl("/auth/callback", window.location.href);
  const recoveryCallback = () => authRedirectUrl("/auth/recovery", window.location.href);

  const finish = async (currentIdentity: AccountIdentity) => {
    const person = { ...draft, id: currentIdentity.userId, nickname: draft.nickname.trim(), owner: true };
    const arrangement = people.map(item => ({ personId: item.owner ? currentIdentity.userId : item.id, plotX: item.plotX, plotY: item.plotY }));
    const snapshot: AccountSnapshot = { userId: currentIdentity.userId, email: currentIdentity.email, person, arrangement, inviteContext };
    await account.save(snapshot);
    clearOnboardingDraft();
    onComplete(snapshot);
  };

  const authenticate = async () => {
    setBusy(true); setError(""); setErrorCode("");
    try {
      if (intent === "create" && password !== confirmPassword) throw new AccountError("invalid_credentials", "Those passwords don’t match.");
      const result = intent === "create"
        ? await account.signUp(email, password, authCallback())
        : await account.signIn(email, password);
      if (result.existing) { clearOnboardingDraft(); onComplete(result.existing); return; }
      if (result.confirmationRequired) { setCooldown(45); go(CHECK_EMAIL); return; }
      if (!result.identity) throw new AccountError("network", "Your account was created, but the session could not be started.");
      setIdentity(result.identity); setEmail(result.identity.email); go(NAME);
    } catch (reason) { report(reason, intent === "create" ? "Your account could not be created." : "Sign in failed."); }
    finally { setBusy(false); }
  };

  const resendConfirmation = async () => {
    setBusy(true); setError(""); setErrorCode("");
    try { await account.resendConfirmation(email, authCallback()); setCooldown(45); }
    catch (reason) { report(reason, "The confirmation email could not be resent."); }
    finally { setBusy(false); }
  };

  const beginRecovery = async () => {
    if (!/^\S+@\S+\.\S+$/.test(email)) { setError("Enter the email used for your Pluoto account first."); return; }
    setBusy(true); setError(""); setErrorCode("");
    try {
      const result = await account.sendPasswordRecovery(email, recoveryCallback());
      if (result.localToken) { setLocalRecoveryToken(result.localToken); setPassword(""); setConfirmPassword(""); go(RESET_PASSWORD); }
      else go(RECOVERY_SENT);
    } catch (reason) { report(reason, "The recovery email could not be sent."); }
    finally { setBusy(false); }
  };

  const completeLocalRecovery = async () => {
    setBusy(true); setError(""); setErrorCode("");
    try {
      if (password !== confirmPassword) throw new AccountError("invalid_credentials", "Those passwords don’t match.");
      const result = await account.completeLocalPasswordRecovery(email, localRecoveryToken, password);
      if (result.existing) { clearOnboardingDraft(); onComplete(result.existing); return; }
      if (!result.identity) throw new AccountError("network", "The local recovery could not be completed.");
      setIdentity(result.identity); go(NAME);
    } catch (reason) { report(reason, "The password could not be updated."); }
    finally { setBusy(false); }
  };

  const saveEdits = async () => {
    setBusy(true); setError("");
    try {
      const restored = await account.restore();
      if (restored) {
        const person = { ...draft, id: restored.userId, nickname: draft.nickname.trim(), owner: true };
        const arrangement = people.map(item => ({ personId: item.owner ? restored.userId : item.id, plotX: item.plotX, plotY: item.plotY }));
        const snapshot = { ...restored, person, arrangement, inviteContext: restored.inviteContext ?? inviteContext };
        await account.save(snapshot); onComplete(snapshot); return;
      }
      onComplete({ userId: owner.id, email: "", person: { ...draft, nickname: draft.nickname.trim() }, arrangement: people.map(item => ({ personId: item.id, plotX: item.plotX, plotY: item.plotY })), inviteContext });
    } catch (reason) { report(reason, "Your changes could not be saved."); }
    finally { setBusy(false); }
  };

  const primary = async () => {
    if (step === NAME) return go(CHARACTER);
    if (step === CHARACTER) return go(PILLS);
    if (step === PILLS) return go(LAND);
    if (step === LAND) return editing ? saveEdits() : identity ? finish(identity) : go(AUTH);
    if (step === RESET_PASSWORD) return completeLocalRecovery();
  };
  const disabled = busy || (step === NAME && !draft.nickname.trim()) || (step === LAND && !editing && !identity) || (step === RESET_PASSWORD && (password.length < MIN_PASSWORD_LENGTH || password !== confirmPassword));
  const preview = step === LAND ? <LandPreview3D person={draft}/> : step >= NAME && step <= PILLS ? <CharacterPreview3D person={draft}/> : null;
  const back = () => {
    if (editing) { if (step > NAME) go(step - 1); else onCancel?.(); return; }
    if (step === NAME && identity) return;
    if (step === AUTH || step === CHECK_EMAIL || step === RECOVERY_SENT || step === RESET_PASSWORD) go(WELCOME);
    else if (step > NAME) go(step - 1);
  };

  return <div className="onboarding-shell">
    <header className="onboarding-header">
      <button disabled={(step === WELCOME || (step === NAME && Boolean(identity))) && !editing} onClick={back} aria-label="Back"><ArrowLeft/></button>
      <a className="onboarding-wordmark">pluoto</a>
      {onCancel ? <button onClick={onCancel} aria-label="Close"><X/></button> : <span/>}
    </header>
    {!editing && identity && <div className="onboarding-progress" aria-label={`Customization step ${Math.max(1, step - 2)} of 4`}>{[NAME, CHARACTER, PILLS, LAND].map(value => <i key={value} className={value <= step ? "active" : ""}/>)}</div>}
    <main className={`onboarding-main step-${step}`}>
      {preview && <section className="onboarding-stage">{preview}</section>}
      <section className="onboarding-panel">
        {step === WELCOME && <div className="welcome-copy"><span className="world-orbit">✦</span><p className="eyebrow">WELCOME TO PLUOTO</p><h1>Your people,<br/>in one little world.</h1><p>Create an account, then make a small Character and a corner of the sky that feels like yours.</p><button className="primary wide" onClick={() => { setIntent("create"); go(AUTH); }}>Create account</button><button className="text-button" onClick={() => { setIntent("signin"); go(AUTH); }}>Sign in</button></div>}
        {step === AUTH && <form id="pluoto-auth-form" onSubmit={event => { event.preventDefault(); void authenticate(); }}>
          <p className="eyebrow">{intent === "signin" ? "WELCOME BACK" : "CREATE ACCOUNT"}</p><h1>{intent === "signin" ? "Enter your Plane." : "Keep your little world."}</h1>
          <p>{intent === "signin" ? "Sign in to restore your Character, land, friends and arrangement." : "Use an email and password. You’ll confirm your email before entering Pluoto."}</p>
          <label className="field-label auth-field"><Mail size={18}/><span>Email</span><input autoFocus type="email" name="email" autoComplete="email" required value={email} onChange={event => setEmail(event.target.value)} placeholder="you@example.com"/></label>
          <label className="field-label auth-field"><span>Password</span><input type={showPassword ? "text" : "password"} name="password" autoComplete={intent === "signin" ? "current-password" : "new-password"} minLength={MIN_PASSWORD_LENGTH} required value={password} onChange={event => setPassword(event.target.value)} placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`}/><button type="button" className="password-toggle" onClick={() => setShowPassword(value => !value)} aria-label={showPassword ? "Hide password" : "Show password"}>{showPassword ? <EyeOff size={17}/> : <Eye size={17}/>}</button></label>
          {intent === "create" && <label className="field-label auth-field"><span>Confirm password</span><input type={showPassword ? "text" : "password"} name="confirm-password" autoComplete="new-password" minLength={MIN_PASSWORD_LENGTH} required value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)}/></label>}
          {account.mode === "local" && <div className="local-mode-note"><strong>Local account preview</strong><span>Supabase is not configured. This device stores only a salted password verifier; no email is sent.</span></div>}
          <button className="primary auth-submit" type="submit" disabled={busy || !/^\S+@\S+\.\S+$/.test(email) || password.length < MIN_PASSWORD_LENGTH || (intent === "create" && password !== confirmPassword)}>{busy ? "One moment…" : intent === "signin" ? "Sign in" : "Create account"}</button>
          {intent === "signin" && <button type="button" className="text-button" onClick={() => void beginRecovery()}>Set or reset password</button>}
          {errorCode === "email_unconfirmed" && <button type="button" className="text-button" disabled={cooldown > 0 || busy} onClick={() => void resendConfirmation()}>{cooldown ? `Resend confirmation in ${cooldown}s` : "Resend confirmation email"}</button>}
          <button type="button" className="text-button" onClick={() => { setIntent(value => value === "signin" ? "create" : "signin"); setPassword(""); setConfirmPassword(""); setError(""); }}>{intent === "signin" ? "Create a new account" : "Already have an account? Sign in"}</button>
        </form>}
        {step === CHECK_EMAIL && <><p className="eyebrow">CHECK YOUR EMAIL</p><h1>Confirm your account.</h1><p>Open the verification link sent to <strong>{email}</strong>. Your choices and invitation will be waiting when you return.</p><button className="resend-button" disabled={cooldown > 0 || busy} onClick={() => void resendConfirmation()}><RotateCcw size={15}/>{cooldown ? `Resend in ${cooldown}s` : "Resend confirmation"}</button><button className="text-button" onClick={() => go(AUTH)}>Use a different email</button></>}
        {step === RECOVERY_SENT && <><p className="eyebrow">CHECK YOUR EMAIL</p><h1>Reset your password.</h1><p>Open the secure recovery link sent to <strong>{email}</strong>. It keeps the same Pluoto account and all of its world data.</p><button className="secondary wide" onClick={() => go(AUTH)}>Back to sign in</button></>}
        {step === RESET_PASSWORD && <><p className="eyebrow">LOCAL RECOVERY</p><h1>Choose a new password.</h1><p>This local-only recovery stands in for the email link Supabase sends.</p><label className="field-label auth-field"><span>New password</span><input autoFocus type={showPassword ? "text" : "password"} autoComplete="new-password" minLength={MIN_PASSWORD_LENGTH} value={password} onChange={event => setPassword(event.target.value)}/><button type="button" className="password-toggle" onClick={() => setShowPassword(value => !value)} aria-label={showPassword ? "Hide password" : "Show password"}>{showPassword ? <EyeOff size={17}/> : <Eye size={17}/>}</button></label><label className="field-label auth-field"><span>Confirm password</span><input type={showPassword ? "text" : "password"} autoComplete="new-password" value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)}/></label></>}
        {step === NAME && <><p className="eyebrow">YOUR NAME</p><h1>What should we call you?</h1><label className="field-label">Nickname<input autoFocus maxLength={18} value={draft.nickname} onChange={event => update({ nickname: event.target.value })} placeholder="e.g. Ren"/></label><p className="onboarding-note">This is what people in your Plane will see.</p></>}
        {step === CHARACTER && <>
          <p className="eyebrow">YOUR CHARACTER</p><h1>Make a little you.</h1>
          <h3>Animal</h3><div className="option-grid species-options">{SPECIES.map(item => <button key={item} className={draft.species === item ? "selected" : ""} onClick={() => update({ species: item })}>{item}</button>)}</div>
          <h3>Fur or body</h3><div className="swatches">{BODY_COLORS.map(item => <button key={item} aria-label={item} className={draft.color === item ? "selected" : ""} style={{ background: item }} onClick={() => update({ color: item })}/>)}</div>
          <h3>Top</h3><div className="option-grid">{OUTFITS.map(item => <button key={item} className={draft.outfit === item ? "selected" : ""} onClick={() => update({ outfit: item })}>{item === "none" ? "No top" : item === "tee" ? "Soft tee" : item === "striped" ? "Striped tee" : "Sunny tee"}</button>)}</div>
          <h3>Headwear <span className="choice-hint">Choose one</span></h3><div className="option-grid" role="radiogroup" aria-label="Headwear">{[null,...HEADWEAR].map(item => <button key={item??"none"} role="radio" aria-checked={item?selectedAccessories(draft).includes(item):!selectedAccessories(draft).some(value=>HEADWEAR.includes(value))} className={item?selectedAccessories(draft).includes(item)?"selected":"":!selectedAccessories(draft).some(value=>HEADWEAR.includes(value))?"selected":""} onClick={() => chooseHeadwear(item)}>{item??"None"}</button>)}</div>
          <h3>Other accessories <span className="choice-hint">Choose any</span></h3><div className="option-grid">{OTHER_ACCESSORIES.map(item => <button key={item} aria-pressed={selectedAccessories(draft).includes(item)} className={selectedAccessories(draft).includes(item) ? "selected" : ""} onClick={() => toggleAccessory(item)}>{item}</button>)}</div>
          {selectedAccessories(draft).map(item=><div className="accessory-colour-row" key={item}><span>{item} colour</span><div className="swatches">{ACCESSORY_COLORS.map(color=><button key={color} aria-label={`${item} ${color}`} aria-pressed={accessoryColorFor(draft,item)===color} className={accessoryColorFor(draft,item)===color?"selected":""} style={{background:color}} onClick={()=>setAccessoryColor(item,color)}/>)}</div></div>)}
        </>}
        {step === PILLS && <><p className="eyebrow">IDENTITY PILLS</p><h1>A few things about you.</h1><p>Choose as many as feel useful, or skip for now.</p>{Object.entries(PILL_GROUPS).map(([group, items]) => {const count=items.filter(item => draft.pills.includes(item)).length;return <details key={group}><summary>{group}{count>0&&<span aria-label={`${count} selected`}>{count} selected</span>}</summary><div className="pills selectable">{items.map(pill => <button key={pill} aria-pressed={draft.pills.includes(pill)} className={`${pillCategoryClass(pill)} ${draft.pills.includes(pill) ? "selected" : ""}`} onClick={() => togglePill(pill)}>{draft.pills.includes(pill) && <Check size={12}/>} {pill}</button>)}</div></details>;})}<button className="text-button" onClick={() => go(LAND)}>Skip for now</button></>}
        {step === LAND && <><p className="eyebrow">YOUR 5 × 5 LAND</p><h1>Make your corner feel like home.</h1><p className="onboarding-note">Every set is grid-safe and leaves open ground for movement.</p><h3>Ground</h3><div className="option-grid">{GROUNDS.map(item => <button key={item} className={draft.ground === item ? "selected" : ""} onClick={() => update({ ground: item })}>{item === "earth" ? "warm earth" : item}</button>)}</div><h3>House</h3><div className="option-grid">{HOMES.map(item => <button key={item} className={draft.home === item ? "selected" : ""} onClick={() => update({ home: item,landObjects:draft.landObjects?.map(object=>object.modelId.startsWith("house.")?{...object,modelId:`house.${item}` as typeof object.modelId}:object) })}>{item}</button>)}</div><h3>House colour</h3><div className="option-grid">{HOUSE_COLORS.map(item => <button key={item} className={draft.houseColor === item ? "selected" : ""} onClick={() => update({ houseColor: item })}>{item}</button>)}</div><h3>Decoration set</h3><div className="option-grid">{DECORATION_PRESETS.map((item: DecorationPreset) => <button key={item} className={draft.decorationPreset === item ? "selected" : ""} onClick={() => setDraft(value => applyDecorationPreset(value, item))}>{item}</button>)}<button className={draft.decorationPreset === "custom" ? "selected" : ""} onClick={() => setDraft(value => applyDecorationPreset(value, "custom"))}>Custom</button></div></>}
        {error && <div className="form-error" role="alert">{error}</div>}
      </section>
    </main>
    {(step === NAME || step === CHARACTER || step === PILLS || step === LAND || step === RESET_PASSWORD) && <footer className="onboarding-footer"><button className="primary" type="button" disabled={disabled} onClick={() => void primary()}>{busy ? "One moment…" : step === LAND && editing ? "Save changes" : step === LAND ? "Enter my Plane" : step === RESET_PASSWORD ? "Save new password" : "Continue"}</button></footer>}
  </div>;
}

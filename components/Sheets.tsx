"use client";

import { useState } from "react";
import { Check, ChevronLeft, Clock3, ShieldOff, Trash2, X } from "lucide-react";
import type { AppState, BubbleEntry, GuestIdentity, Ground, Person, Species } from "@/lib/types";
import { PILL_GROUPS } from "@/lib/demo";
import { Character } from "./Character";
import {pillCategory, pillCategoryClass} from "@/lib/pills";

export function PersonSheet({ person, canManage=true, onEditLand, onClose, onRemove, onBlock }: { person: Person; owner: Person; canManage?:boolean; onEditLand?:()=>void; onClose: () => void; onRemove: () => void; onBlock: () => void }) {
  const groups = Object.keys(PILL_GROUPS).map(category => ({category,pills:person.pills.filter(pill=>pillCategory(pill)===category)})).filter(group=>group.pills.length);
  return <div className="sheet-backdrop" onPointerDown={onClose}><section className="bottom-sheet person-sheet" onPointerDown={(e) => e.stopPropagation()}>
    <button className="sheet-close" onClick={onClose}><X size={19}/></button>
    <Character species={person.species} color={person.color} accent={person.accent} accessory={person.accessory} accessories={person.accessories} accessoryColor={person.accessoryColor} accessoryColors={person.accessoryColors} size={104}/>
    <p className="eyebrow">IN YOUR PLANE</p><h2>{person.nickname}</h2>
    {person.bubble && <div className="sheet-bubble">“{person.bubble}”</div>}
    {groups.length ? <div className="identity-groups">{groups.map(group=><section key={group.category}><h3>{group.category}</h3><div className="pills identity-pills">{group.pills.map((pill) => <span className={pillCategoryClass(pill)} key={pill}>{pill}</span>)}</div></section>)}</div> : <p className="identity-empty">{person.owner ? "You haven’t added any identity Pills yet." : `${person.nickname} hasn’t added any identity Pills yet.`}</p>}
    {person.owner&&onEditLand&&<button className="primary wide person-edit-land" onClick={onEditLand}>Edit my land</button>}
    {canManage && !person.owner && <details className="friend-actions"><summary>Friend settings</summary><div><button onClick={onRemove}><Trash2 size={16}/> Remove from Plane</button><button className="danger" onClick={onBlock}><ShieldOff size={16}/> Block {person.nickname}</button></div></details>}
  </section></div>;
}

type CustomizeProps = { owner: Person; onSave: (person: Person) => void; onClose: () => void };
const species: Species[] = ["fox", "rabbit", "bear", "cat", "penguin", "turtle", "dog"];
const colors = ["#e8794d", "#d9a16f", "#f1d0b5", "#8aae87", "#6d86a9", "#ba7a92", "#65534d"];
const grounds: Ground[] = ["grass", "sand", "stone", "earth"];

export function CustomizeFlow({ owner, onSave, onClose }: CustomizeProps) {
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState(owner);
  const steps = ["Hello", "Character", "Your vibe", "Your plot"];
  const togglePill = (pill: string) => setDraft((value) => ({ ...value, pills: value.pills.includes(pill) ? value.pills.filter((item) => item !== pill) : [...value.pills, pill] }));
  return <div className="full-flow">
    <header><button onClick={step ? () => setStep(step - 1) : onClose}><ChevronLeft/></button><div className="flow-progress">{steps.map((_, index) => <i className={index <= step ? "active" : ""} key={index}/>)}</div><button onClick={onClose}><X/></button></header>
    <main>
      {step === 0 && <div className="flow-step intro-step"><div className="mini-world"><Character species={draft.species} color={draft.color} accent={draft.accent} accessory={draft.accessory} size={116}/></div><p className="eyebrow">WELCOME TO PLUOTO</p><h1>My people,<br/>around me.</h1><p>Make a little you, then build your corner of the sky.</p><label>Your nickname<input value={draft.nickname} maxLength={18} onChange={(e) => setDraft({ ...draft, nickname: e.target.value })}/></label></div>}
      {step === 1 && <div className="flow-step"><p className="eyebrow">YOUR CHARACTER</p><h1>Who feels like you?</h1><div className="species-grid">{species.map((item) => <button className={draft.species === item ? "selected" : ""} key={item} onClick={() => setDraft({ ...draft, species: item })}><Character species={item} color={draft.color} accent={draft.accent} size={72}/><span>{item}</span></button>)}</div><h3>Fur colour</h3><div className="swatches">{colors.map((color) => <button key={color} className={draft.color === color ? "selected" : ""} style={{ background: color }} onClick={() => setDraft({ ...draft, color })}/>)}</div><h3>One little extra</h3><div className="choice-row">{(["none", "glasses", "headphones", "cap", "tote", "scarf"] as const).map((item) => <button key={item} className={draft.accessory === item ? "selected" : ""} onClick={() => setDraft({ ...draft, accessory: item })}>{item}</button>)}</div></div>}
      {step === 2 && <div className="flow-step pills-step"><p className="eyebrow">YOUR VIBE</p><h1>A few things about you</h1><p>Pick as many as feel right. No awkward five-tag limit.</p>{Object.entries(PILL_GROUPS).map(([group, items]) => <section key={group}><h3>{group}</h3><div className="pills selectable">{items.map((pill) => <button className={draft.pills.includes(pill) ? "selected" : ""} onClick={() => togglePill(pill)} key={pill}>{draft.pills.includes(pill) && <Check size={13}/>} {pill}</button>)}</div></section>)}</div>}
      {step === 3 && <div className="flow-step plot-step"><p className="eyebrow">YOUR 5 × 5 PLOT</p><h1>Make home feel like yours</h1><div className={`plot-preview ground-${draft.ground}`}><div className="plot-grid"/><div className={`preview-home ${draft.home}`}/><Character species={draft.species} color={draft.color} accent={draft.accent} accessory={draft.accessory} size={72}/></div><h3>Ground</h3><div className="choice-row">{grounds.map((item) => <button className={draft.ground === item ? "selected" : ""} onClick={() => setDraft({ ...draft, ground: item })} key={item}>{item}</button>)}</div><h3>Home</h3><div className="choice-row">{(["cottage", "studio", "cabin"] as const).map((item) => <button className={draft.home === item ? "selected" : ""} onClick={() => setDraft({ ...draft, home: item })} key={item}>{item}</button>)}</div><h3>Objects</h3><div className="choice-row"><button className={draft.scene === "ren" ? "selected" : ""} onClick={() => setDraft({ ...draft, scene: "ren" })}>mailbox + bench</button><button className={draft.scene === "sarah" ? "selected" : ""} onClick={() => setDraft({ ...draft, scene: "sarah" })}>garden + picnic</button><button className={draft.scene === "maya" ? "selected" : ""} onClick={() => setDraft({ ...draft, scene: "maya" })}>palm + deckchair</button></div><p className="plot-note">Every set stays grid-snapped and leaves plenty of open ground.</p></div>}
    </main>
    <footer><button className="primary wide" disabled={!draft.nickname.trim()} onClick={() => step < 3 ? setStep(step + 1) : onSave({ ...draft, nickname: draft.nickname.trim() })}>{step < 3 ? "Continue" : "Enter my Plane"}</button></footer>
  </div>;
}

export function BubbleSheet({ owner, log, onPublish, onClear, onDelete, onClearAll, onClose }: { owner: Person; log: BubbleEntry[]; onPublish: (text: string) => Promise<void>; onClear: () => Promise<void>; onDelete:(id:string)=>Promise<void>; onClearAll:()=>Promise<void>; onClose: () => void }) {
  const [text, setText] = useState(owner.bubble ?? "");
  const [showLog, setShowLog] = useState(false);
  const [busy,setBusy]=useState(false);const [error,setError]=useState("");
  const [hiddenIds,setHiddenIds]=useState<Set<string>>(()=>new Set());
  const [clearedCurrent,setClearedCurrent]=useState(false);
  const [allCleared,setAllCleared]=useState(false);
  const visibleLog=allCleared?[]:log.filter(item=>!hiddenIds.has(item.id));
  const currentBubble=!clearedCurrent?owner.bubble:undefined;
  const remove=async(id:string)=>{setHiddenIds(value=>new Set(value).add(id));setBusy(true);setError("");try{await onDelete(id);}catch(cause){setHiddenIds(value=>{const next=new Set(value);next.delete(id);return next;});setError(cause instanceof Error?cause.message:"This Bubble could not be deleted.");}finally{setBusy(false);}};
  const save=async()=>{const next=text.trim();if(!next&&!owner.bubble)return;setBusy(true);setError("");try{if(next)await onPublish(next);else{await onClear();setText("");}}catch(cause){setError(cause instanceof Error?cause.message:"Your Bubble could not be saved.");}finally{setBusy(false);}};
  const clear=async()=>{setClearedCurrent(true);setBusy(true);setError("");try{await onClear();setText("");}catch(cause){setClearedCurrent(false);setError(cause instanceof Error?cause.message:"Your Bubble could not be cleared.");}finally{setBusy(false);}};
  const clearAll=async()=>{if(!window.confirm("Clear all past Bubbles? Your current Bubble will stay active."))return;setAllCleared(true);setBusy(true);setError("");try{await onClearAll();}catch(cause){setAllCleared(false);setError(cause instanceof Error?cause.message:"Your Bubble Log could not be cleared.");}finally{setBusy(false);}};
  return <div className="sheet-backdrop" onPointerDown={onClose}><section className="bottom-sheet" onPointerDown={(e) => e.stopPropagation()}><button className="sheet-close" onClick={onClose}><X/></button>{showLog ? <><p className="eyebrow">PRIVATE</p><h2>Bubble Log</h2><p>Only you can see these thoughts.</p><div className="bubble-log" aria-live="polite">{currentBubble&&<div className="bubble-log-entry"><span>{currentBubble}</span><time>Current</time><button aria-label="Current Bubble cannot be deleted from the log" title="Current Bubble stays until cleared or replaced" disabled><Trash2 size={15}/></button></div>}{visibleLog.length === 0&&!currentBubble ? <div className="empty-state">Your Bubbles will settle here.</div> : visibleLog.map((item) => <div className="bubble-log-entry" key={item.id}><span>{item.text}</span><time>{new Date(item.createdAt).toLocaleDateString()}</time><button aria-label="Delete Bubble from log" title="Delete Bubble" disabled={busy} onClick={()=>void remove(item.id)}><Trash2 size={15}/></button></div>)}</div>{error&&<div className="form-error" role="alert">{error}</div>}<div className="bubble-log-actions"><button className="secondary" onClick={() => setShowLog(false)}>Back to Bubble</button><button className="clear-all-bubbles" disabled={busy||visibleLog.length===0} onClick={()=>void clearAll()}><Trash2 size={15}/> Clear all</button></div></> : <><p className="eyebrow">AMBIENTLY HERE</p><h2>What’s floating around?</h2><p>Your friends see one short thought above your Character for 24 hours.</p><textarea autoFocus maxLength={80} value={text} placeholder="coffee later?" onChange={(e) => setText(e.target.value)}/><div className="text-meta"><span>{text.length}/80</span><span><Clock3 size={14}/> 24 hours</span></div>{error&&<div className="form-error">{error} Your draft is still here.</div>}<div className="bubble-sheet-actions"><button className="primary wide" disabled={busy||(!owner.bubble&&!text.trim())} onClick={save}>{busy?"Saving…":owner.bubble&&!text.trim()?"Clear Bubble":owner.bubble ? "Replace Bubble" : "Publish Bubble"}</button>{owner.bubble&&<button className="secondary wide clear-current-bubble" disabled={busy} onClick={clear}><Trash2 size={15}/> Clear current Bubble</button>}</div><button className="text-button" onClick={() => setShowLog(true)}>View private Bubble Log</button></>}</section></div>;
}

const guestSpecies=["fox","rabbit","cat","turtle"] as const satisfies readonly Species[];
type GuestSpecies=(typeof guestSpecies)[number];
const guestColors:Record<GuestSpecies,string>={fox:"#e8794d",rabbit:"#f7eee5",cat:"#d9a16f",turtle:"#79a875"};

export function GuestJoin({planeName,onJoin}:{planeName:string;onJoin:(draft:{nickname:string;species:Species;color:string})=>void}) {
  const [nickname,setNickname]=useState("");
  const [animal,setAnimal]=useState<GuestSpecies>("fox");
  return <div className="guest-gate"><section className="guest-card">
    <p className="eyebrow">YOU’RE INVITED</p><h1>Visit {planeName}</h1><p>Choose a little visitor identity. No account, email or password needed.</p>
    <label>Your nickname<input autoFocus maxLength={18} value={nickname} placeholder="e.g. Ari" onChange={event=>setNickname(event.target.value)}/></label>
    <fieldset><legend>Starter animal <span>optional</span></legend><div className="guest-species">{guestSpecies.map(item=><button type="button" key={item} className={animal===item?"selected":""} onClick={()=>setAnimal(item)}><Character species={item} color={guestColors[item]} accent="#fff2df" size={62}/><span>{item}</span></button>)}</div></fieldset>
    <button className="primary wide" disabled={!nickname.trim()} onClick={()=>onJoin({nickname:nickname.trim(),species:animal,color:guestColors[animal]})}>Enter the Plane</button>
    <small>An anonymous identity is remembered only on this device.</small>
  </section></div>;
}

export function GuestMenu({guest,mode,onClose}:{guest:GuestIdentity;mode:'realtime'|'local';onClose:()=>void}) {
  return <div className="profile-popover guest-profile"><button className="popover-close" onClick={onClose}><X size={17}/></button><div className="profile-title"><Character species={guest.species} color={guest.color} accent="#fff2df" size={65}/><div><strong>{guest.nickname}</strong><span>ANONYMOUS GUEST</span></div></div><p>You’re visiting this Plane without an account.</p><div className="profile-stats"><span><b>{mode==='realtime'?"Live":"Local"}</b> connection</span></div></div>;
}

export function ProfileMenu({ state, email, onCustomize, onEditLand, onBubble, onSignOut, onClose }: { state: AppState; email?:string; onCustomize: () => void; onEditLand:()=>void; onBubble: () => void; onSignOut:()=>void; onClose: () => void }) {
  const owner = state.people.find((person) => person.owner)!;
  return <div className="profile-popover"><button className="popover-close" onClick={onClose}><X size={17}/></button><div className="profile-title"><Character species={owner.species} color={owner.color} accent={owner.accent} accessory={owner.accessory} accessories={owner.accessories} accessoryColor={owner.accessoryColor} accessoryColors={owner.accessoryColors} size={65}/><div><strong>{owner.nickname}</strong><span>{email??"LOCAL PLANE"}</span></div></div><button onClick={onBubble}>Write a Bubble <span>{owner.bubble ? "active" : ""}</span></button><button onClick={onEditLand}>Edit objects on my land</button><button onClick={onCustomize}>Customize Character & theme</button><button onClick={onSignOut}>Sign out</button><div className="profile-stats"><span><b>{state.people.length - 1}</b> people</span><span><b>{state.blocked.length}</b> blocked</span></div></div>;
}

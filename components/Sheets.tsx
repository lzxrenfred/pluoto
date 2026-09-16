"use client";

import { useMemo, useState } from "react";
import { Check, ChevronLeft, Clock3, Copy, QrCode, ShieldOff, Trash2, X } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import type { AppState, BubbleEntry, Ground, Person, Species } from "@/lib/types";
import { PILL_GROUPS } from "@/lib/demo";
import { Character } from "./Character";

export function PersonSheet({ person, owner, onClose, onRemove, onBlock }: { person: Person; owner: Person; onClose: () => void; onRemove: () => void; onBlock: () => void }) {
  const shared = person.pills.filter((pill) => owner.pills.includes(pill));
  return <div className="sheet-backdrop" onPointerDown={onClose}><section className="bottom-sheet person-sheet" onPointerDown={(e) => e.stopPropagation()}>
    <button className="sheet-close" onClick={onClose}><X size={19}/></button>
    <Character species={person.species} color={person.color} accent={person.accent} accessory={person.accessory} size={104}/>
    <p className="eyebrow">IN YOUR PLANE</p><h2>{person.nickname}</h2>
    {person.bubble && <div className="sheet-bubble">“{person.bubble}”</div>}
    <div className="pills">{person.pills.map((pill) => <span className={shared.includes(pill) ? "shared" : ""} key={pill}>{shared.includes(pill) && "✦ "}{pill}</span>)}</div>
    {!person.owner && <details className="friend-actions"><summary>Friend settings</summary><div><button onClick={onRemove}><Trash2 size={16}/> Remove from Plane</button><button className="danger" onClick={onBlock}><ShieldOff size={16}/> Block {person.nickname}</button></div></details>}
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

export function BubbleSheet({ owner, log, onPublish, onClose }: { owner: Person; log: BubbleEntry[]; onPublish: (text: string) => void; onClose: () => void }) {
  const [text, setText] = useState(owner.bubble ?? "");
  const [showLog, setShowLog] = useState(false);
  return <div className="sheet-backdrop" onPointerDown={onClose}><section className="bottom-sheet" onPointerDown={(e) => e.stopPropagation()}><button className="sheet-close" onClick={onClose}><X/></button>{showLog ? <><p className="eyebrow">PRIVATE</p><h2>Bubble Log</h2><p>Only you can see past thoughts.</p><div className="bubble-log">{log.length === 0 ? <div className="empty-state">Your old Bubbles will settle here.</div> : log.map((item) => <div key={item.id}><span>{item.text}</span><time>{new Date(item.createdAt).toLocaleDateString()}</time></div>)}</div><button className="secondary wide" onClick={() => setShowLog(false)}>Back to Bubble</button></> : <><p className="eyebrow">AMBIENTLY HERE</p><h2>What’s floating around?</h2><p>Your friends see one short thought above your Character for 24 hours.</p><textarea autoFocus maxLength={80} value={text} placeholder="coffee later?" onChange={(e) => setText(e.target.value)}/><div className="text-meta"><span>{text.length}/80</span><span><Clock3 size={14}/> 24 hours</span></div><button className="primary wide" disabled={!text.trim()} onClick={() => onPublish(text.trim())}>{owner.bubble ? "Replace Bubble" : "Publish Bubble"}</button><button className="text-button" onClick={() => setShowLog(true)}>View private Bubble Log</button></>}</section></div>;
}

export function FriendSheet({ onClose, onAdd }: { onClose: () => void; onAdd: (person: Person) => void }) {
  const [tab, setTab] = useState<"code" | "add" | "requests">("code");
  const [code, setCode] = useState("");
  const [preview, setPreview] = useState(false);
  const candidate = useMemo<Person>(() => ({ id: "lio", nickname: "Lio", species: "dog", color: "#b9865b", accent: "#f4dfc6", accessory: "cap", plotX: 2, plotY: 0, ground: "sand", home: "studio", scene: "new", pills: ["easygoing", "music", "one-on-one", "travel"] }), []);
  return <div className="sheet-backdrop" onPointerDown={onClose}><section className="bottom-sheet friend-sheet" onPointerDown={(e) => e.stopPropagation()}><button className="sheet-close" onClick={onClose}><X/></button><p className="eyebrow">BRING SOMEONE CLOSER</p><h2>Add a friend</h2><nav className="segmented"><button className={tab === "code" ? "active" : ""} onClick={() => setTab("code")}>My code</button><button className={tab === "add" ? "active" : ""} onClick={() => setTab("add")}>Scan / enter</button><button className={tab === "requests" ? "active" : ""} onClick={() => setTab("requests")}>Requests <b>1</b></button></nav>
    {tab === "code" && <div className="code-panel"><div className="qr"><QRCodeSVG value="https://pluoto.local/add/REN-825" size={168} fgColor="#14283c" bgColor="#fffdf7"/></div><p>Let a friend scan this</p><button className="code-copy" onClick={() => navigator.clipboard?.writeText("REN-825")}><span>REN-825</span><Copy size={17}/></button><small>Your nickname, Character, Plot preview and a few Pills are shared before they accept.</small></div>}
    {tab === "add" && <div className="add-panel">{!preview ? <><button className="scan-button"><QrCode/> Scan their code</button><div className="or"><i/>or<i/></div><label>Short code<div><input value={code} placeholder="e.g. LIO-204" onChange={(e) => setCode(e.target.value.toUpperCase())}/><button onClick={() => setPreview(true)} disabled={code.length < 3}>Preview</button></div></label></> : <div className="request-preview"><Character species={candidate.species} color={candidate.color} accent={candidate.accent} accessory={candidate.accessory} size={100}/><h3>{candidate.nickname}</h3><div className="mini-plot-card">5 × 5 sand plot · blue studio</div><div className="pills">{candidate.pills.map((pill) => <span key={pill}>{pill}</span>)}</div><button className="primary wide" onClick={() => onAdd(candidate)}>Send request & demo accept</button><small>In the live flow, Lio must accept before either of you can place a Plot.</small></div>}</div>}
    {tab === "requests" && <div className="request-item"><Character species="dog" color="#6f8b65" accent="#ead6bd" accessory="none" size={76}/><div><strong>Noa</strong><span>coffee · student · quiet at first</span></div><button className="icon-accept" aria-label="Accept"><Check/></button><button className="icon-decline" aria-label="Decline"><X/></button></div>}
  </section></div>;
}

export function ProfileMenu({ state, onCustomize, onBubble, onClose }: { state: AppState; onCustomize: () => void; onBubble: () => void; onClose: () => void }) {
  const owner = state.people.find((person) => person.owner)!;
  return <div className="profile-popover"><button className="popover-close" onClick={onClose}><X size={17}/></button><div className="profile-title"><Character species={owner.species} color={owner.color} accent={owner.accent} accessory={owner.accessory} size={65}/><div><strong>{owner.nickname}</strong><span>PLUOTO CODE · REN-825</span></div></div><button onClick={onBubble}>Write a Bubble <span>{owner.bubble ? "active" : ""}</span></button><button onClick={onCustomize}>Customize me & my Plot</button><div className="profile-stats"><span><b>{state.people.length - 1}</b> people</span><span><b>{state.blocked.length}</b> blocked</span></div></div>;
}

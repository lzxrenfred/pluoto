"use client";

import { useMemo, useState } from "react";
import { Check, Move, Share2, Sparkles } from "lucide-react";
import { Character } from "@/components/Character";
import { BubbleSheet, CustomizeFlow, GuestJoin, GuestMenu, InviteSheet, PersonSheet, ProfileMenu } from "@/components/Sheets";
import dynamic from 'next/dynamic';
const World = dynamic(() => import('@/components/World3D'), {ssr:false});
import { usePlane } from "@/lib/use-plane";
import type { Person } from "@/lib/types";

export default function Home() {
  const {state,setState,hydrated,inviteUrl,viewer,needsGuestJoin,joinGuest,mode}=usePlane();
  const [arrangeMode, setArrangeMode] = useState(false);
  const [selected, setSelected] = useState<Person | null>(null);
  const [sheet, setSheet] = useState<"invite" | "bubble" | "customize" | "profile" | null>(null);
  const [showWelcome, setShowWelcome] = useState(false);

  const owner = useMemo(() => state.people.find((person) => person.owner) ?? state.people[0], [state.people]);
  const isGuest=viewer?.role==='guest';
  const viewerCharacter=isGuest&&viewer?viewer:owner;
  const updatePeople = (people: Person[]) => setState((value) => ({ ...value, people }));
  const closeAll = () => { setSelected(null); setSheet(null); };

  const saveOwner = (nextOwner: Person) => {
    setState((value) => ({ ...value, completedOnboarding: true, people: value.people.map((person) => person.owner ? nextOwner : person) }));
    setShowWelcome(false);
    setSheet(null);
  };

  const publishBubble = (text: string) => {
    const now = Date.now();
    setState((value) => {
      const previous = value.people.find((person) => person.owner)?.bubble;
      const log = previous ? [{ id: `bubble-${now}`, text: previous, createdAt: value.people.find((person) => person.owner)?.bubbleCreatedAt ?? now, expiredAt: now }, ...value.bubbleLog] : value.bubbleLog;
      return { ...value, bubbleLog: log, people: value.people.map((person) => person.owner ? { ...person, bubble: text, bubbleCreatedAt: now } : person) };
    });
    setSheet(null);
  };

  const removePerson = (id: string, block = false) => {
    setState((value) => ({ ...value, people: value.people.filter((person) => person.id !== id), blocked: block ? [...new Set([...value.blocked, id])] : value.blocked }));
    setSelected(null);
  };

  if (!hydrated) return <main className="loading"><div className="brand-mark">p</div></main>;

  return <main className="app-shell">
    <header className="app-header">
      <div className="brand"><div className="brand-orbit"><i/>p</div><div><strong>Pluoto</strong><span>{owner.nickname}’s Plane</span></div></div>
      <div className="plane-visitors" aria-label={`${state.guests.length} guests have joined`}>{state.guests.slice(-3).map(guest=><span key={guest.id} title={`${guest.nickname} is visiting`}><Character species={guest.species} color={guest.color} accent="#fff2df" size={28}/></span>)}</div>
      <button className="profile-button" onClick={() => setSheet(sheet === "profile" ? null : "profile")} aria-label="Open profile"><Character species={viewerCharacter.species} color={viewerCharacter.color} accent={'accent' in viewerCharacter?viewerCharacter.accent:'#fff2df'} accessory={'accessory' in viewerCharacter?viewerCharacter.accessory:'none'} size={43}/><i/></button>
      {sheet === "profile" && (isGuest&&viewer?<GuestMenu guest={viewer} mode={mode} onClose={()=>setSheet(null)}/>:<ProfileMenu state={state} onCustomize={() => setSheet("customize")} onBubble={() => setSheet("bubble")} onClose={() => setSheet(null)}/>)}
    </header>

    <World people={state.people} arrangeMode={!isGuest&&arrangeMode} showOwnerBadge={!isGuest} motionPaused={!!selected || !!sheet || showWelcome} onPeopleChange={isGuest?()=>undefined:updatePeople} onCharacterClick={setSelected}/>

    <nav className="action-dock">
      <button onClick={() => setSheet("invite")}><Share2 size={19}/><span>Invite</span></button>
      {!isGuest&&<button className={arrangeMode ? "active" : ""} onClick={() => setArrangeMode((value) => !value)}>{arrangeMode ? <Check size={18}/> : <Move size={18}/>}<span>{arrangeMode ? "Done" : "Arrange"}</span></button>}
    </nav>

    {arrangeMode && <div className="arrange-banner"><Sparkles size={16}/><span>Make the sky feel like yours</span><button onClick={() => setArrangeMode(false)}>Done</button></div>}
    {selected && <PersonSheet person={selected} owner={owner} canManage={!isGuest} onClose={() => setSelected(null)} onRemove={() => removePerson(selected.id)} onBlock={() => removePerson(selected.id, true)}/>}
    {sheet === "invite" && inviteUrl && <InviteSheet inviteUrl={inviteUrl} mode={mode} onClose={closeAll}/>}
    {sheet === "bubble" && <BubbleSheet owner={owner} log={state.bubbleLog} onPublish={publishBubble} onClose={closeAll}/>} 
    {sheet === "customize" && <CustomizeFlow owner={owner} onSave={saveOwner} onClose={closeAll}/>} 
    {showWelcome&&!isGuest && <div className="welcome-card"><button className="welcome-close" onClick={() => setShowWelcome(false)}>×</button><div className="welcome-art"><Character species="fox" color="#e8794d" accent="#fff2df" accessory="scarf" size={100}/><i/><i/></div><p className="eyebrow">WELCOME TO PLUOTO</p><h1>Your people,<br/>in one little world.</h1><p>Each piece of land is someone you care about. Look around, then make yours.</p><button className="primary wide" onClick={() => { setShowWelcome(false); setSheet("customize"); }}>Make it mine</button><button className="text-button" onClick={() => setShowWelcome(false)}>Explore Ren’s demo</button></div>}
    {needsGuestJoin&&<GuestJoin planeName={`${owner.nickname}’s Plane`} onJoin={joinGuest}/>}
  </main>;
}

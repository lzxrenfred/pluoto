"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Move, Plus, Sparkles } from "lucide-react";
import { Character } from "@/components/Character";
import { BubbleSheet, CustomizeFlow, FriendSheet, PersonSheet, ProfileMenu } from "@/components/Sheets";
import { World } from "@/components/World";
import { INITIAL_STATE } from "@/lib/demo";
import type { AppState, Person } from "@/lib/types";

const STORAGE_KEY = "pluoto-state-v2-isometric";

export default function Home() {
  const [state, setState] = useState<AppState>(INITIAL_STATE);
  const [hydrated, setHydrated] = useState(false);
  const [arrangeMode, setArrangeMode] = useState(false);
  const [selected, setSelected] = useState<Person | null>(null);
  const [sheet, setSheet] = useState<"friends" | "bubble" | "customize" | "profile" | null>(null);
  const [showWelcome, setShowWelcome] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as AppState;
        const now = Date.now();
        const expired = parsed.people.filter((person) => person.bubble && person.bubbleCreatedAt && now - person.bubbleCreatedAt >= 86_400_000);
        setState({
          ...parsed,
          people: parsed.people.map((person) => expired.some((item) => item.id === person.id) ? { ...person, bubble: undefined, bubbleCreatedAt: undefined } : person),
          bubbleLog: [
            ...expired.filter((person) => person.owner).map((person) => ({ id: `expired-${person.bubbleCreatedAt}`, text: person.bubble!, createdAt: person.bubbleCreatedAt!, expiredAt: now })),
            ...(parsed.bubbleLog ?? []),
          ],
        });
      }
      else setShowWelcome(true);
    } catch { /* demo remains usable */ }
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state, hydrated]);

  const owner = useMemo(() => state.people.find((person) => person.owner) ?? state.people[0], [state.people]);
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

  const addFriend = (person: Person) => {
    setState((value) => ({ ...value, people: value.people.some((item) => item.id === person.id) ? value.people : [...value.people, person] }));
    setSheet(null);
    setArrangeMode(true);
  };

  const removePerson = (id: string, block = false) => {
    setState((value) => ({ ...value, people: value.people.filter((person) => person.id !== id), blocked: block ? [...new Set([...value.blocked, id])] : value.blocked }));
    setSelected(null);
  };

  if (!hydrated) return <main className="loading"><div className="brand-mark">p</div></main>;

  return <main className="app-shell">
    <header className="app-header">
      <div className="brand"><div className="brand-orbit"><i/>p</div><div><strong>Pluoto</strong><span>{owner.nickname}’s Plane</span></div></div>
      <button className="profile-button" onClick={() => setSheet(sheet === "profile" ? null : "profile")} aria-label="Open profile"><Character species={owner.species} color={owner.color} accent={owner.accent} accessory={owner.accessory} size={43}/><i/></button>
      {sheet === "profile" && <ProfileMenu state={state} onCustomize={() => setSheet("customize")} onBubble={() => setSheet("bubble")} onClose={() => setSheet(null)}/>} 
    </header>

    <World people={state.people} arrangeMode={arrangeMode} motionPaused={!!selected || !!sheet || showWelcome} onPeopleChange={updatePeople} onCharacterClick={setSelected}/>

    <nav className="action-dock">
      <button onClick={() => setSheet("friends")}><Plus size={19}/><span>Add friend</span>{state.people.length === 4 && <i/>}</button>
      <button className={arrangeMode ? "active" : ""} onClick={() => setArrangeMode((value) => !value)}>{arrangeMode ? <Check size={18}/> : <Move size={18}/>}<span>{arrangeMode ? "Done" : "Arrange"}</span></button>
    </nav>

    {arrangeMode && <div className="arrange-banner"><Sparkles size={16}/><span>Make the sky feel like yours</span><button onClick={() => setArrangeMode(false)}>Done</button></div>}
    {selected && <PersonSheet person={selected} owner={owner} onClose={() => setSelected(null)} onRemove={() => removePerson(selected.id)} onBlock={() => removePerson(selected.id, true)}/>} 
    {sheet === "friends" && <FriendSheet onClose={closeAll} onAdd={addFriend}/>} 
    {sheet === "bubble" && <BubbleSheet owner={owner} log={state.bubbleLog} onPublish={publishBubble} onClose={closeAll}/>} 
    {sheet === "customize" && <CustomizeFlow owner={owner} onSave={saveOwner} onClose={closeAll}/>} 
    {showWelcome && <div className="welcome-card"><button className="welcome-close" onClick={() => setShowWelcome(false)}>×</button><div className="welcome-art"><Character species="fox" color="#e8794d" accent="#fff2df" accessory="scarf" size={100}/><i/><i/></div><p className="eyebrow">WELCOME TO PLUOTO</p><h1>Your people,<br/>in one little world.</h1><p>Each piece of land is someone you care about. Look around, then make yours.</p><button className="primary wide" onClick={() => { setShowWelcome(false); setSheet("customize"); }}>Make it mine</button><button className="text-button" onClick={() => setShowWelcome(false)}>Explore Ren’s demo</button></div>}
  </main>;
}

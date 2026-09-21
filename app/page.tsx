"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, Move, Settings, Share2, X } from "lucide-react";
import { Character } from "@/components/Character";
import { BubbleSheet, GuestJoin, GuestMenu, PersonSheet, ProfileMenu } from "@/components/Sheets";
import { OnboardingFlow, clearOnboardingDraft } from "@/components/OnboardingFlow";
import {FriendCenter,FriendInviteLanding} from "@/components/FriendCenter";
import dynamic from "next/dynamic";
import { beginArrangement } from "@/lib/world-interactions";
import { usePlane } from "@/lib/use-plane";
import type { Person } from "@/lib/types";
import { createAccountStore, readInviteContext, type AccountSnapshot, type AccountStore } from "@/lib/account-store";
import {createFriendStore,FriendError,type FriendPreview,type FriendRecord,type FriendState,type FriendStore} from "@/lib/friend-store";
import {isSlotFree} from "@/lib/world";

const World = dynamic(() => import("@/components/World3D"), { ssr: false });

export default function Home() {
  const { state, setState, hydrated, viewer, needsGuestJoin, joinGuest, mode } = usePlane();
  const [arrangeDraft, setArrangeDraft] = useState<Person[] | null>(null);
  const [selected, setSelected] = useState<Person | null>(null);
  const [sheet, setSheet] = useState<"invite" | "bubble" | "customize" | "profile" | null>(null);
  const [showWelcome, setShowWelcome] = useState(false);
  const [resetSignal, setResetSignal] = useState(0);
  const [account, setAccount] = useState<AccountStore | null>(null);
  const [accountSnapshot, setAccountSnapshot] = useState<AccountSnapshot | null>(null);
  const [accountReady, setAccountReady] = useState(false);
  const [forceAccountGate, setForceAccountGate] = useState(false);
  const [friendStore,setFriendStore]=useState<FriendStore|null>(null);
  const [friendState,setFriendState]=useState<FriendState|null>(null);
  const [friendLoading,setFriendLoading]=useState(false);
  const [friendInvitePreview,setFriendInvitePreview]=useState<FriendPreview|null>(null);
  const [friendInviteError,setFriendInviteError]=useState("");
  const [friendInviteBusy,setFriendInviteBusy]=useState(false);
  const [friendInviteResolved,setFriendInviteResolved]=useState(false);
  const [inviteAuthStarted,setInviteAuthStarted]=useState(false);
  const [openFriendsAfterAuth,setOpenFriendsAfterAuth]=useState(false);
  const socialIds=useRef(new Set<string>());

  const owner = useMemo(() => state.people.find((person) => person.owner) ?? state.people[0], [state.people]);
  const onboardingOwner = useMemo(() => forceAccountGate ? {...owner,nickname:"",pills:[],accessory:"none" as const,outfit:"none" as const,species:"fox" as const,color:"#e8794d",accent:"#fff2df"} : owner, [forceAccountGate,owner]);
  const isGuest = viewer?.role === "guest";
  const viewerCharacter = isGuest && viewer ? viewer : owner;
  const visiblePeople = arrangeDraft ?? state.people;
  const arranging = !isGuest && arrangeDraft !== null;
  const closeAll = () => { setSelected(null); setSheet(null); };
  const inviteContext=hydrated&&typeof window!=="undefined"?readInviteContext(window.location.href):undefined;
  const friendInviteToken=inviteContext?.friendInviteToken;

  const applyAccount = useCallback((snapshot: AccountSnapshot) => {
    setAccountSnapshot(snapshot);
    setForceAccountGate(false);
    setState(value => {
      const positions = new Map(snapshot.arrangement.map(item => [item.personId, item]));
      return {...value, completedOnboarding:true, requiresOnboarding:false, accountRequired:true, people:value.people.map(person => {
        if(person.owner) {
          const position=positions.get(snapshot.person.id);
          return {...snapshot.person,plotX:position?.plotX??person.plotX,plotY:position?.plotY??person.plotY,owner:true};
        }
        const position=positions.get(person.id);
        return position?{...person,plotX:position.plotX,plotY:position.plotY}:person;
      })};
    });
    setShowWelcome(false);setSheet(null);
  },[setState]);

  useEffect(()=>{
    if(!hydrated)return;
    const store=createAccountStore();
    const social=createFriendStore();
    setAccount(store);
    setFriendStore(social);
    void store.restore().then(snapshot=>{if(snapshot)applyAccount(snapshot);}).catch(error=>console.warn("Account restoration failed",error)).finally(()=>setAccountReady(true));
    try{const draft=JSON.parse(localStorage.getItem("pluoto-onboarding-draft-v2")??"null") as {inviteContext?:{friendInviteToken?:string}}|null;if(draft?.inviteContext?.friendInviteToken)setInviteAuthStarted(true);}catch{}
  },[applyAccount,hydrated]);

  const refreshFriends=useCallback(async()=>{
    if(!accountSnapshot||!friendStore)return;
    setFriendLoading(true);
    try{
      const result=await friendStore.list(accountSnapshot);const previous=socialIds.current;const current=new Set(result.friends.map(friend=>friend.preview.userId));socialIds.current=current;setFriendState(result);
      const placed=result.friends.filter(friend=>friend.placement&&!friend.placement.hidden);
      setState(value=>{const next=value.people.filter(person=>!previous.has(person.id)||placed.some(friend=>friend.preview.userId===person.id));for(const friend of placed){const placement=friend.placement!;const person={...friend.preview.person,owner:false,plotX:placement.plotX,plotY:placement.plotY};const index=next.findIndex(item=>item.id===person.id);if(index>=0)next[index]=person;else next.push(person);}return{...value,people:next};});
    }catch(error){console.warn("Friend refresh failed",error);}finally{setFriendLoading(false);}
  },[accountSnapshot,friendStore,setState]);

  useEffect(()=>{if(!accountSnapshot||!friendStore)return;void refreshFriends();return friendStore.subscribe(accountSnapshot,()=>void refreshFriends());},[accountSnapshot,friendStore,refreshFriends]);
  useEffect(()=>{if(accountSnapshot&&openFriendsAfterAuth&&friendState){setSheet("invite");setOpenFriendsAfterAuth(false);}},[accountSnapshot,friendState,openFriendsAfterAuth]);
  useEffect(()=>{if(!friendInviteToken||!friendStore||friendInviteResolved)return;setFriendInviteError("");void friendStore.preview(friendInviteToken).then(setFriendInvitePreview).catch(error=>setFriendInviteError(error instanceof FriendError?error.message:"That invitation is unavailable."));},[friendInviteResolved,friendInviteToken,friendStore]);

  const signOut=async()=>{await account?.signOut();clearOnboardingDraft();setAccountSnapshot(null);setSheet(null);setForceAccountGate(true);};

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
    const connected=friendState?.friends.find(friend=>friend.preview.userId===id);
    if(connected&&accountSnapshot&&friendStore){const accepted=window.confirm(block?`Block ${connected.preview.person.nickname}? This also removes the friendship and both placements.`:`Remove ${connected.preview.person.nickname} as a friend? Both placements will be removed.`);if(!accepted)return;void (block?friendStore.blockUser(accountSnapshot,id):friendStore.removeFriend(accountSnapshot,id)).then(refreshFriends);setSelected(null);return;}
    setState((value) => ({ ...value, people: value.people.filter((person) => person.id !== id), blocked: block ? [...new Set([...value.blocked, id])] : value.blocked }));
    setSelected(null);
  };

  const startArrange = () => {
    closeAll();
    setArrangeDraft(beginArrangement(state.people));
  };

  const cancelArrange = () => setArrangeDraft(null);
  const finishArrange = () => {
    if (!arrangeDraft) return;
    setState((value) => ({ ...value, people: arrangeDraft }));
    if(accountSnapshot&&account) {
      const next={...accountSnapshot,arrangement:arrangeDraft.map(person=>({personId:person.id,plotX:person.plotX,plotY:person.plotY}))};
      setAccountSnapshot(next);void account.save(next).catch(error=>console.warn("Account arrangement save failed",error));
    }
    if(accountSnapshot&&friendStore&&friendState){for(const friend of friendState.friends){const person=arrangeDraft.find(item=>item.id===friend.preview.userId);if(person)void friendStore.setPlacement(accountSnapshot,person.id,{plotX:person.plotX,plotY:person.plotY,hidden:false});}}
    setArrangeDraft(null);
  };

  const firstFree=useCallback((people:Person[])=>{for(let radius=1;radius<15;radius++)for(let y=-radius;y<=radius;y++)for(let x=-radius;x<=radius;x++)if(Math.max(Math.abs(x),Math.abs(y))===radius&&isSlotFree({plotX:x,plotY:y},people))return{plotX:x,plotY:y};return{plotX:0,plotY:0};},[]);
  const placeFriend=(friend:FriendRecord)=>{const position=friend.placement??firstFree(state.people);const person={...friend.preview.person,owner:false,plotX:position.plotX,plotY:position.plotY};setArrangeDraft(beginArrangement([...state.people.filter(item=>item.id!==person.id),person]));setSheet(null);};
  const hideFriend=(friend:FriendRecord)=>{if(!accountSnapshot||!friendStore)return;const position=friend.placement??{plotX:0,plotY:0,hidden:true};void friendStore.setPlacement(accountSnapshot,friend.preview.userId,{plotX:position.plotX,plotY:position.plotY,hidden:true}).then(refreshFriends);};
  const removeFriend=(friend:FriendRecord)=>{if(!accountSnapshot||!friendStore||!window.confirm(`Remove ${friend.preview.person.nickname} as a friend? Both placements will be removed.`))return;void friendStore.removeFriend(accountSnapshot,friend.preview.userId).then(refreshFriends);};
  const blockFriend=(friend:FriendRecord)=>{if(!accountSnapshot||!friendStore||!window.confirm(`Block ${friend.preview.person.nickname}? They won’t be able to send another request.`))return;void friendStore.blockUser(accountSnapshot,friend.preview.userId).then(refreshFriends);};
  const openFriends=()=>{if(!accountSnapshot){setOpenFriendsAfterAuth(true);setForceAccountGate(true);return;}setSheet("invite");};
  const clearInviteUrl=()=>{const url=new URL(window.location.href);url.searchParams.delete("invite");window.history.replaceState({},"",url);setFriendInviteResolved(true);setFriendInvitePreview(null);};
  const acceptPersonalInvite=async()=>{if(!accountSnapshot||!friendStore||!friendInviteToken)return;setFriendInviteBusy(true);setFriendInviteError("");try{await friendStore.acceptInvitation(accountSnapshot,friendInviteToken);await refreshFriends();clearInviteUrl();setSheet("invite");}catch(error){setFriendInviteError(error instanceof FriendError?error.message:"The invitation could not be accepted.");}finally{setFriendInviteBusy(false);}};

  if (!hydrated || !owner || !viewerCharacter || !accountReady || !account || !friendStore) return <main className="loading"><div className="brand-mark">p</div></main>;

  if(friendInviteToken&&!friendInviteResolved&&friendInvitePreview&&(!inviteAuthStarted||accountSnapshot))return <FriendInviteLanding preview={friendInvitePreview} signedIn={Boolean(accountSnapshot)} busy={friendInviteBusy} error={friendInviteError} onAuthenticate={()=>{setInviteAuthStarted(true);setForceAccountGate(true);}} onAccept={acceptPersonalInvite} onLater={clearInviteUrl}/>;
  if(friendInviteToken&&!friendInviteResolved&&!friendInvitePreview&&!friendInviteError)return <main className="loading"><div className="brand-mark">p</div></main>;
  if(friendInviteToken&&!friendInviteResolved&&friendInviteError)return <div className="friend-invite-gate"><section><p className="eyebrow">INVITATION UNAVAILABLE</p><h1>This link can’t be used.</h1><div className="form-error">{friendInviteError}</div><button className="secondary wide" onClick={clearInviteUrl}>{inviteAuthStarted?"Continue without this invitation":"Go to Pluoto"}</button></section></div>;

  if (!isGuest && (state.requiresOnboarding || forceAccountGate || (state.accountRequired&&!accountSnapshot))) return <OnboardingFlow owner={onboardingOwner} people={state.people} account={account} inviteContext={readInviteContext(window.location.href)} onComplete={applyAccount}/>;

  return <main className="app-shell">
    <header className="app-header">
      <button className="wordmark" onClick={() => setResetSignal((value) => value + 1)} aria-label="Recenter Plane">
        <strong>pluoto</strong>
        <span>{owner.nickname}’s Plane</span>
      </button>
      <div className="corner-actions">
        <button className="profile-button" onClick={() => isGuest ? setSheet(sheet === "profile" ? null : "profile") : setSelected(owner)} aria-label="Open my Character">
          <Character species={viewerCharacter.species} color={viewerCharacter.color} accent={"accent" in viewerCharacter ? viewerCharacter.accent : "#fff2df"} accessory={"accessory" in viewerCharacter ? viewerCharacter.accessory : "none"} size={43}/>
        </button>
        <button className="settings-button" onClick={() => setSheet(sheet === "profile" ? null : "profile")} aria-label="Open settings"><Settings size={21}/></button>
      </div>
      {sheet === "profile" && (isGuest && viewer ? <GuestMenu guest={viewer} mode={mode} onClose={() => setSheet(null)}/> : <ProfileMenu state={state} email={accountSnapshot?.email} onCustomize={() => setSheet("customize")} onBubble={() => setSheet("bubble")} onSignOut={signOut} onClose={() => setSheet(null)}/>)}
    </header>

    <World
      people={visiblePeople}
      arrangeMode={arranging}
      canPlay={!isGuest}
      selectedId={selected?.id}
      resetSignal={resetSignal}
      motionPaused={!!selected || !!sheet || showWelcome}
      onPeopleChange={setArrangeDraft}
      onCharacterClick={setSelected}
    />

    {!arranging && <nav className="action-dock" aria-label="Plane actions">
      <button onClick={openFriends}><Share2 size={19}/><span>Friends</span></button>
      {!isGuest && <button onClick={startArrange}><Move size={18}/><span>Arrange</span></button>}
    </nav>}

    {arranging && <nav className="arrange-controls" aria-label="Arrange controls">
      <button onClick={cancelArrange}><X size={18}/><span>Cancel</span></button>
      <button className="primary" onClick={finishArrange}><Check size={18}/><span>Done</span></button>
    </nav>}

    {selected && <PersonSheet person={selected} owner={owner} canManage={!isGuest} onClose={() => setSelected(null)} onRemove={() => removePerson(selected.id)} onBlock={() => removePerson(selected.id, true)}/>}
    {sheet === "invite" && accountSnapshot && friendState && <FriendCenter actor={accountSnapshot} state={friendState} store={friendStore} onRefresh={refreshFriends} onClose={closeAll} onPlace={placeFriend} onHide={hideFriend} onRemove={removeFriend} onBlock={blockFriend}/>}
    {sheet === "invite" && accountSnapshot && !friendState && <div className="sheet-backdrop"><section className="bottom-sheet"><button className="sheet-close" onClick={closeAll}><X/></button><p>{friendLoading?"Loading friends…":"Friend service unavailable."}</p></section></div>}
    {sheet === "bubble" && <BubbleSheet owner={owner} log={state.bubbleLog} onPublish={publishBubble} onClose={closeAll}/>}
    {sheet === "customize" && <OnboardingFlow editing owner={owner} people={state.people} account={account} inviteContext={readInviteContext(window.location.href)} onComplete={applyAccount} onCancel={closeAll}/>}
    {showWelcome && !isGuest && <div className="welcome-card"><button className="welcome-close" onClick={() => setShowWelcome(false)}>×</button><div className="welcome-art"><Character species="fox" color="#e8794d" accent="#fff2df" accessory="scarf" size={100}/><i/><i/></div><p className="eyebrow">WELCOME TO PLUOTO</p><h1>Your people,<br/>in one little world.</h1><p>Each piece of land is someone you care about. Look around, then make yours.</p><button className="primary wide" onClick={() => { setShowWelcome(false); setSheet("customize"); }}>Make it mine</button><button className="text-button" onClick={() => setShowWelcome(false)}>Explore Ren’s demo</button></div>}
    {needsGuestJoin && <GuestJoin planeName={`${owner.nickname}’s Plane`} onJoin={joinGuest}/>}
  </main>;
}

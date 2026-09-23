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
import type { LandObject, Person } from "@/lib/types";
import { createAccountStore, readInviteContext, type AccountSnapshot, type AccountStore } from "@/lib/account-store";
import {createFriendStore,FriendError,type FriendPreview,type FriendRecord,type FriendState,type FriendStore} from "@/lib/friend-store";
import {isSlotFree} from "@/lib/world";
import {createBubbleStore,type BubbleState,type BubbleStore} from "@/lib/bubble-store";
import {withoutSeededDemoFriends} from "@/lib/demo";

const World = dynamic(() => import("@/components/World3D"), { ssr: false });
const LandEditor = dynamic(() => import("@/components/LandEditor3D"), { ssr: false });
const CharacterPortrait3D = dynamic(() => import("@/components/CustomizationPreview3D").then(module => module.CharacterPortrait3D), { ssr: false });

function InlineBubbleComposer({current,onPublish,onClear,onOpen}: {current?:string;onPublish:(text:string)=>Promise<void>;onClear:()=>Promise<void>;onOpen:()=>void}) {
  const [expanded,setExpanded]=useState(false);const [text,setText]=useState(current??"");const [error,setError]=useState("");const [busy,setBusy]=useState(false);
  useEffect(()=>{if(!expanded)setText(current??"");},[current,expanded]);
  const publish=async()=>{const next=text.trim();if(!next&&!current){setExpanded(false);return;}setBusy(true);setError("");try{if(next)await onPublish(next);else await onClear();setExpanded(false);}catch(cause){setError(cause instanceof Error?cause.message:"Your Bubble could not be saved.");}finally{setBusy(false);}};
  return <section className={`inline-bubble-composer ${expanded?"expanded":""}`} aria-label="Bubble composer">
    {!expanded?<button onClick={()=>setExpanded(true)}><span>{current??"What’s on your mind?"}</span><b>{current?"Edit":"Bubble"}</b></button>:<>
      <textarea autoFocus maxLength={80} value={text} placeholder="What’s on your mind?" onChange={event=>setText(event.target.value)}/>
      <div className="inline-bubble-meta"><span>{error||`${text.length}/80 · visible for 24 hours`}</span><button onClick={()=>{setExpanded(false);setError("");}}>Cancel</button><button className="primary" disabled={busy||(!current&&!text.trim())} onClick={publish}>{busy?"Saving…":current&&!text.trim()?"Clear":current?"Update":"Publish"}</button></div>
      <button className="inline-bubble-more" onClick={onOpen}>Bubble history</button>
    </>}
  </section>;
}

export default function Home() {
  const { state, setState, hydrated, viewer, needsGuestJoin, joinGuest, mode } = usePlane();
  const [arrangeDraft, setArrangeDraft] = useState<Person[] | null>(null);
  const [arrangeBusy,setArrangeBusy]=useState(false);
  const [arrangeError,setArrangeError]=useState("");
  const pendingPlacements=useRef(new Map<string,{plotX:number;plotY:number}>());
  const [selected, setSelected] = useState<Person | null>(null);
  const [sheet, setSheet] = useState<"invite" | "bubble" | "customize" | "profile" | null>(null);
  const [showWelcome, setShowWelcome] = useState(false);
  const [editingLand, setEditingLand] = useState(false);
  const [resetSignal, setResetSignal] = useState(0);
  const [account, setAccount] = useState<AccountStore | null>(null);
  const [accountSnapshot, setAccountSnapshot] = useState<AccountSnapshot | null>(null);
  const [accountReady, setAccountReady] = useState(false);
  const [forceAccountGate, setForceAccountGate] = useState(false);
  const [friendStore,setFriendStore]=useState<FriendStore|null>(null);
  const [bubbleStore,setBubbleStore]=useState<BubbleStore|null>(null);
  const [friendState,setFriendState]=useState<FriendState|null>(null);
  const [friendLoading,setFriendLoading]=useState(false);
  const [friendInvitePreview,setFriendInvitePreview]=useState<FriendPreview|null>(null);
  const [friendInviteError,setFriendInviteError]=useState("");
  const [friendInviteBusy,setFriendInviteBusy]=useState(false);
  const [friendInviteResolved,setFriendInviteResolved]=useState(false);
  const [inviteAuthStarted,setInviteAuthStarted]=useState(false);
  const [openFriendsAfterAuth,setOpenFriendsAfterAuth]=useState(false);
  const socialIds=useRef(new Set<string>());
  const friendRefreshId=useRef(0);

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
      const retained=withoutSeededDemoFriends(value.people);
      const base=retained.some(person=>person.owner)?retained:[snapshot.person];
      return {...value, completedOnboarding:true, requiresOnboarding:false, accountRequired:true, people:base.map(person => {
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
    const bubbles=createBubbleStore();
    setAccount(store);
    setFriendStore(social);
    setBubbleStore(bubbles);
    void store.restore().then(snapshot=>{if(snapshot)applyAccount(snapshot);}).catch(error=>console.warn("Account restoration failed",error)).finally(()=>setAccountReady(true));
    try{const draft=JSON.parse(localStorage.getItem("pluoto-onboarding-draft-v2")??"null") as {inviteContext?:{friendInviteToken?:string}}|null;if(draft?.inviteContext?.friendInviteToken)setInviteAuthStarted(true);}catch{}
  },[applyAccount,hydrated]);

  const refreshFriends=useCallback(async()=>{
    if(!accountSnapshot||!friendStore)return;
    const requestId=++friendRefreshId.current;
    setFriendLoading(true);
    try{
      const result=await friendStore.list(accountSnapshot);if(requestId!==friendRefreshId.current)return;const previous=socialIds.current;const current=new Set(result.friends.map(friend=>friend.preview.userId));socialIds.current=current;setFriendState(result);
      const placed=result.friends.filter(friend=>friend.placement&&!friend.placement.hidden);
      setState(value=>{const next=value.people.filter(person=>!previous.has(person.id)||placed.some(friend=>friend.preview.userId===person.id));for(const friend of placed){const placement=pendingPlacements.current.get(friend.preview.userId)??friend.placement!;const person={...friend.preview.person,owner:false,plotX:placement.plotX,plotY:placement.plotY};const index=next.findIndex(item=>item.id===person.id);if(index>=0)next[index]=person;else next.push(person);}return{...value,people:next};});
    }catch(error){console.warn("Friend refresh failed",error);}finally{if(requestId===friendRefreshId.current)setFriendLoading(false);}
  },[accountSnapshot,friendStore,setState]);

  useEffect(()=>{if(!accountSnapshot||!friendStore)return;void refreshFriends();return friendStore.subscribe(accountSnapshot,()=>void refreshFriends());},[accountSnapshot,friendStore,refreshFriends]);
  const applyBubbleState=useCallback((result:BubbleState)=>setState(value=>({...value,bubbleLog:result.archive,people:value.people.map(person=>person.owner?{...person,bubble:result.active?.text,bubbleCreatedAt:result.active?.createdAt,bubbleExpiresAt:result.active?.expiresAt}:person)})),[setState]);
  useEffect(()=>{if(!accountSnapshot||!bubbleStore)return;const refresh=()=>void bubbleStore.load(accountSnapshot).then(applyBubbleState).catch(error=>console.warn("Bubble refresh failed",error));refresh();return bubbleStore.subscribe(accountSnapshot,refresh);},[accountSnapshot,applyBubbleState,bubbleStore]);
  useEffect(()=>{
    const active=state.people.filter(person=>person.bubble&&person.bubbleCreatedAt).map(person=>({id:person.id,expiresAt:person.bubbleExpiresAt??person.bubbleCreatedAt!+86_400_000}));
    if(!active.length)return;
    const expire=()=>{const now=Date.now();setState(value=>({...value,people:value.people.map(person=>{const expiry=person.bubbleExpiresAt??(person.bubbleCreatedAt?person.bubbleCreatedAt+86_400_000:Infinity);return person.bubble&&expiry<=now?{...person,bubble:undefined,bubbleCreatedAt:undefined,bubbleExpiresAt:undefined}:person;})}));if(accountSnapshot&&bubbleStore)void bubbleStore.load(accountSnapshot).then(applyBubbleState).catch(()=>undefined);};
    const next=Math.min(...active.map(item=>item.expiresAt));const delay=Math.max(0,next-Date.now());
    if(delay===0){expire();return;}const timer=window.setTimeout(expire,Math.min(delay,2_147_000_000));return()=>window.clearTimeout(timer);
  },[accountSnapshot,applyBubbleState,bubbleStore,setState,state.people]);
  useEffect(()=>{if(accountSnapshot&&openFriendsAfterAuth&&friendState){setSheet("invite");setOpenFriendsAfterAuth(false);}},[accountSnapshot,friendState,openFriendsAfterAuth]);
  useEffect(()=>{if(!friendInviteToken||!friendStore||friendInviteResolved)return;setFriendInviteError("");void friendStore.preview(friendInviteToken).then(setFriendInvitePreview).catch(error=>setFriendInviteError(error instanceof FriendError?error.message:"That invitation is unavailable."));},[friendInviteResolved,friendInviteToken,friendStore]);

  const signOut=async()=>{await account?.signOut();clearOnboardingDraft();setAccountSnapshot(null);setSheet(null);setForceAccountGate(true);};

  const publishBubble = async (text: string) => {
    if(!accountSnapshot||!bubbleStore)throw new Error("Sign in to publish a Bubble.");
    const result=await bubbleStore.publish(accountSnapshot,text);applyBubbleState(result);
  };
  const clearBubble=async()=>{if(!accountSnapshot||!bubbleStore)return;const result=await bubbleStore.clear(accountSnapshot);applyBubbleState(result);};
  const deleteBubble=async(id:string)=>{if(!accountSnapshot||!bubbleStore)return;const result=await bubbleStore.remove(accountSnapshot,id);applyBubbleState(result);};
  const clearAllBubbles=async()=>{if(!accountSnapshot||!bubbleStore)return;const result=await bubbleStore.clearAll(accountSnapshot);applyBubbleState(result);};
  const saveLand=async(objects:LandObject[],signPosition:{tileX:number;tileY:number})=>{
    if(!accountSnapshot||!account)throw new Error("Sign in to save your land.");
    const person={...owner,landObjects:objects,signPosition,signPositionVersion:2 as const,decorationPreset:"custom" as const,savedCustomLand:{objects,signPosition,scene:owner.scene}};
    const next={...accountSnapshot,person};
    await account.save(next);
    setAccountSnapshot(next);
    setState(value=>({...value,people:value.people.map(item=>item.owner?person:item)}));
    setEditingLand(false);
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

  const cancelArrange = () => {pendingPlacements.current.clear();setArrangeError("");setArrangeDraft(null);};
  const finishArrange = async () => {
    if (!arrangeDraft || arrangeBusy) return;
    setArrangeBusy(true);setArrangeError("");
    const draft=arrangeDraft;
    try {
      if(accountSnapshot&&account) {
        const next={...accountSnapshot,arrangement:draft.map(person=>({personId:person.id,plotX:person.plotX,plotY:person.plotY}))};
        friendState?.friends.forEach(friend=>{const person=draft.find(item=>item.id===friend.preview.userId);if(person)pendingPlacements.current.set(person.id,{plotX:person.plotX,plotY:person.plotY});});
        await account.save(next);
        if(friendStore&&friendState)await Promise.all(friendState.friends.map(friend=>{const person=draft.find(item=>item.id===friend.preview.userId);return person?friendStore.setPlacement(next,person.id,{plotX:person.plotX,plotY:person.plotY,hidden:false}):Promise.resolve();}));
        setAccountSnapshot(next);
        await refreshFriends();
      }
      setState(value=>({...value,people:draft}));
      setArrangeDraft(null);
      pendingPlacements.current.clear();
    }catch(error){setArrangeError(error instanceof Error?error.message:"The new arrangement could not be saved.");}
    finally{setArrangeBusy(false);}
  };

  const firstFree=useCallback((people:Person[])=>{for(let radius=1;radius<15;radius++)for(let y=-radius;y<=radius;y++)for(let x=-radius;x<=radius;x++)if(Math.max(Math.abs(x),Math.abs(y))===radius&&isSlotFree({plotX:x,plotY:y},people))return{plotX:x,plotY:y};return{plotX:0,plotY:0};},[]);
  const placeFriend=(friend:FriendRecord)=>{const position=friend.placement??firstFree(state.people);const person={...friend.preview.person,owner:false,plotX:position.plotX,plotY:position.plotY};setArrangeDraft(beginArrangement([...state.people.filter(item=>item.id!==person.id),person]));setSheet(null);};
  const hideFriend=(friend:FriendRecord)=>{if(!accountSnapshot||!friendStore)return;const position=friend.placement??{plotX:0,plotY:0,hidden:true};void friendStore.setPlacement(accountSnapshot,friend.preview.userId,{plotX:position.plotX,plotY:position.plotY,hidden:true}).then(refreshFriends);};
  const removeFriend=(friend:FriendRecord)=>{if(!accountSnapshot||!friendStore||!window.confirm(`Remove ${friend.preview.person.nickname} as a friend? Both placements will be removed.`))return;void friendStore.removeFriend(accountSnapshot,friend.preview.userId).then(refreshFriends);};
  const blockFriend=(friend:FriendRecord)=>{if(!accountSnapshot||!friendStore||!window.confirm(`Block ${friend.preview.person.nickname}? They won’t be able to send another request.`))return;void friendStore.blockUser(accountSnapshot,friend.preview.userId).then(refreshFriends);};
  const openFriends=()=>{if(!accountSnapshot){setOpenFriendsAfterAuth(true);setForceAccountGate(true);return;}setSheet("invite");};
  const clearInviteUrl=()=>{const url=new URL(window.location.href);url.searchParams.delete("invite");window.history.replaceState({},"",url);setFriendInviteResolved(true);setFriendInvitePreview(null);};
  const acceptPersonalInvite=async()=>{if(!accountSnapshot||!friendStore||!friendInviteToken)return;setFriendInviteBusy(true);setFriendInviteError("");try{await friendStore.acceptInvitation(accountSnapshot,friendInviteToken);await refreshFriends();clearInviteUrl();setSheet("invite");}catch(error){setFriendInviteError(error instanceof FriendError?error.message:"The invitation could not be accepted.");}finally{setFriendInviteBusy(false);}};

  if (!hydrated || !owner || !viewerCharacter || !accountReady || !account || !friendStore) return <main className="loading" role="status" aria-label="Loading Pluoto"><div className="brand-mark" aria-hidden="true"/></main>;

  if(friendInviteToken&&!friendInviteResolved&&friendInvitePreview&&(!inviteAuthStarted||accountSnapshot))return <FriendInviteLanding preview={friendInvitePreview} signedIn={Boolean(accountSnapshot)} busy={friendInviteBusy} error={friendInviteError} onAuthenticate={()=>{setInviteAuthStarted(true);setForceAccountGate(true);}} onAccept={acceptPersonalInvite} onLater={clearInviteUrl}/>;
  if(friendInviteToken&&!friendInviteResolved&&!friendInvitePreview&&!friendInviteError)return <main className="loading" role="status" aria-label="Loading Pluoto"><div className="brand-mark" aria-hidden="true"/></main>;
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
          <CharacterPortrait3D person={("accent" in viewerCharacter?viewerCharacter:{...owner,id:viewerCharacter.id,nickname:viewerCharacter.nickname,species:viewerCharacter.species,color:viewerCharacter.color,accent:"#fff2df",accessory:"none"}) as Person}/>
        </button>
        <button className="settings-button" onClick={() => setSheet(sheet === "profile" ? null : "profile")} aria-label="Open settings"><Settings size={21}/></button>
      </div>
      {sheet === "profile" && (isGuest && viewer ? <GuestMenu guest={viewer} mode={mode} onClose={() => setSheet(null)}/> : <ProfileMenu state={state} email={accountSnapshot?.email} onCustomize={() => setSheet("customize")} onEditLand={()=>{setSheet(null);setEditingLand(true);}} onBubble={() => setSheet("bubble")} onSignOut={signOut} onClose={() => setSheet(null)}/>)}
    </header>

    <World
      people={visiblePeople}
      arrangeMode={arranging}
      canPlay={!isGuest&&!editingLand}
      selectedId={selected?.id}
      resetSignal={resetSignal}
      motionPaused={!!selected || !!sheet || showWelcome || editingLand}
      onPeopleChange={setArrangeDraft}
      onCharacterClick={setSelected}
    />

    {!arranging && !editingLand && <div className={`home-controls ${isGuest?"guest":""}`}>
      <nav className="action-dock" aria-label="Plane actions">
        <button onClick={openFriends}><Share2 size={19}/><span>Friends</span></button>
        {!isGuest && <button onClick={startArrange}><Move size={18}/><span>Arrange</span></button>}
      </nav>
      {!isGuest && <InlineBubbleComposer current={owner.bubble} onPublish={publishBubble} onClear={clearBubble} onOpen={()=>setSheet("bubble")}/>} 
    </div>}

    {arranging && <><nav className="arrange-controls" aria-label="Arrange controls">
      <button disabled={arrangeBusy} onClick={cancelArrange}><X size={18}/><span>Cancel</span></button>
      <button className="primary" disabled={arrangeBusy} onClick={()=>void finishArrange()}><Check size={18}/><span>{arrangeBusy?"Saving…":"Done"}</span></button>
    </nav>{arrangeError&&<div className="arrange-error" role="alert">{arrangeError}</div>}</>}

    {selected && <PersonSheet person={selected} owner={owner} canManage={!isGuest} onEditLand={selected.owner?()=>{setSelected(null);setEditingLand(true);}:undefined} onClose={() => setSelected(null)} onRemove={() => removePerson(selected.id)} onBlock={() => removePerson(selected.id, true)}/>} 
    {sheet === "invite" && accountSnapshot && friendState && <FriendCenter actor={accountSnapshot} state={friendState} store={friendStore} onRefresh={refreshFriends} onClose={closeAll} onPlace={placeFriend} onHide={hideFriend} onRemove={removeFriend} onBlock={blockFriend}/>}
    {sheet === "invite" && accountSnapshot && !friendState && <div className="sheet-backdrop"><section className="bottom-sheet"><button className="sheet-close" onClick={closeAll}><X/></button><p>{friendLoading?"Loading friends…":"Friend service unavailable."}</p></section></div>}
    {sheet === "bubble" && <BubbleSheet owner={owner} log={state.bubbleLog} onPublish={async text=>{await publishBubble(text);setSheet(null);}} onClear={clearBubble} onDelete={deleteBubble} onClearAll={clearAllBubbles} onClose={closeAll}/>}
    {sheet === "customize" && <OnboardingFlow editing owner={owner} people={state.people} account={account} inviteContext={readInviteContext(window.location.href)} onComplete={applyAccount} onCancel={closeAll}/>} 
    {editingLand&&<LandEditor person={owner} onSave={saveLand} onCancel={()=>setEditingLand(false)}/>} 
    {showWelcome && !isGuest && <div className="welcome-card"><button className="welcome-close" onClick={() => setShowWelcome(false)}>×</button><div className="welcome-art"><Character species="fox" color="#e8794d" accent="#fff2df" accessory="scarf" size={100}/><i/><i/></div><p className="eyebrow">WELCOME TO PLUOTO</p><h1>Your people,<br/>in one little world.</h1><p>Each piece of land is someone you care about. Look around, then make yours.</p><button className="primary wide" onClick={() => { setShowWelcome(false); setSheet("customize"); }}>Make it mine</button><button className="text-button" onClick={() => setShowWelcome(false)}>Explore Ren’s demo</button></div>}
    {needsGuestJoin && <GuestJoin planeName={`${owner.nickname}’s Plane`} onJoin={joinGuest}/>}
  </main>;
}

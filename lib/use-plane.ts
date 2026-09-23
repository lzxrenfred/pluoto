"use client";

import {useCallback,useEffect,useMemo,useRef,useState,type Dispatch,type SetStateAction} from 'react';
import {INITIAL_STATE,withoutSeededDemoFriends} from './demo';
import {createLocalPlaneStore,createPlaneAccessKey,createPlaneStore,isRemotePlaneAccessKey,normalizeState,splitPlaneAccessKey,upsertGuest,type PlaneStore,type StoreMode} from './plane-store';
import type {AppState,GuestIdentity,Species} from './types';

const HOME_PLANE_KEY='pluoto-home-plane-v1';
const LEGACY_STATE_KEY='pluoto-state-v2-isometric';
const identityKey=(planeId:string)=>`pluoto-viewer-v1:${planeId}`;

export function startNewHomePlane() {
  const accessKey=createPlaneAccessKey();
  const access=splitPlaneAccessKey(accessKey);
  localStorage.setItem(HOME_PLANE_KEY,accessKey);
  const url=new URL(window.location.href);
  url.searchParams.set('plane',access.id);
  url.searchParams.set('key',access.inviteToken);
  url.searchParams.delete('join');
  url.searchParams.delete('previewGuest');
  window.location.replace(url.toString());
}

export type ViewerIdentity=GuestIdentity&{role:'host'|'guest'};
type JoinDraft={nickname:string;species:Species;color:string};

function readJson<T>(key:string):T|null {
  try {const value=localStorage.getItem(key);return value?JSON.parse(value) as T:null;} catch {return null;}
}
function expireBubbles(state:AppState):AppState {
  const now=Date.now();
  const expired=state.people.filter(person=>person.bubble&&person.bubbleCreatedAt&&now-person.bubbleCreatedAt>=86_400_000);
  if(!expired.length)return state;
  return {...state,
    people:state.people.map(person=>expired.some(item=>item.id===person.id)?{...person,bubble:undefined,bubbleCreatedAt:undefined}:person),
    bubbleLog:[...expired.filter(person=>person.owner).map(person=>({id:`expired-${person.bubbleCreatedAt}`,text:person.bubble!,createdAt:person.bubbleCreatedAt!,expiredAt:now})),...state.bubbleLog],
  };
}

export function usePlane():{
  state:AppState;setState:Dispatch<SetStateAction<AppState>>;hydrated:boolean;planeId:string;inviteUrl:string;
  viewer:ViewerIdentity|null;needsGuestJoin:boolean;joinGuest:(draft:JoinDraft)=>void;mode:StoreMode;
} {
  const [state,setState]=useState<AppState>(INITIAL_STATE);
  const [hydrated,setHydrated]=useState(false);
  const [planeId,setPlaneId]=useState('');
  const [viewer,setViewer]=useState<ViewerIdentity|null>(null);
  const [joinRequested,setJoinRequested]=useState(false);
  const [mode,setMode]=useState<StoreMode>('local');
  const storeRef=useRef<PlaneStore|null>(null);
  const snapshotRef=useRef('');
  const viewerKeyRef=useRef('');

  useEffect(()=>{
    let disposed=false;
    let unsubscribe:()=>void=()=>{};
    void (async()=>{
      const currentUrl=new URL(window.location.href);
      const requestedId=currentUrl.searchParams.get('plane');
      const requestedToken=currentUrl.searchParams.get('key');
      const requested=requestedId&&requestedToken?`${requestedId}.${requestedToken}`:null;
      const stored=localStorage.getItem(HOME_PLANE_KEY);
      const id=requested||(stored?.includes('.')?stored:createPlaneAccessKey());
      const joining=currentUrl.searchParams.get('join')==='1';
      const previewGuest=currentUrl.searchParams.get('previewGuest');
      if(!requested) {
        localStorage.setItem(HOME_PLANE_KEY,id);
        const access=splitPlaneAccessKey(id);
        currentUrl.searchParams.set('plane',access.id);currentUrl.searchParams.set('key',access.inviteToken);
        window.history.replaceState({},'',currentUrl);
      }
      setPlaneId(id);setJoinRequested(joining);
      const viewerStorageKey=`${identityKey(id)}${previewGuest?`:preview-${previewGuest}`:''}`;
      viewerKeyRef.current=viewerStorageKey;
      const storedViewer=readJson<ViewerIdentity>(viewerStorageKey);
      if(storedViewer)setViewer(storedViewer);

      let store=isRemotePlaneAccessKey(id)?await createPlaneStore():createLocalPlaneStore();
      let loaded:AppState|null=null;
      try {loaded=await store.load(id);} catch(error) {
        console.warn('Configured realtime store is unavailable; continuing locally.',error);
        store=createLocalPlaneStore();loaded=await store.load(id);
      }
      if(disposed)return;
      storeRef.current=store;setMode(store.mode);
      const legacy=requested?null:readJson<Partial<AppState>>(LEGACY_STATE_KEY);
      const freshOwner=INITIAL_STATE.people.find(person=>person.owner)!;
      const fresh={...INITIAL_STATE,requiresOnboarding:true,people:[{...freshOwner,nickname:"",pills:[],accessory:"none" as const,outfit:"none" as const,houseColor:"coral" as const,decorationPreset:"garden" as const}]};
      const seed=loaded??legacy??fresh;
      const seededPeople=Array.isArray(seed.people)?seed.people:fresh.people;
      const next=expireBubbles(normalizeState({...seed,people:withoutSeededDemoFriends(seededPeople)},INITIAL_STATE));
      const snapshot=JSON.stringify(next);
      snapshotRef.current=snapshot;setState(next);
      if(!loaded)await store.save(id,next);

      if(!joining&&!storedViewer) {
        const owner=next.people.find(person=>person.owner)??next.people[0];
        const host:ViewerIdentity={id:store.anonymousId,nickname:owner.nickname,species:owner.species,color:owner.color,joinedAt:Date.now(),role:'host'};
        localStorage.setItem(viewerStorageKey,JSON.stringify(host));setViewer(host);
      }
      unsubscribe=store.subscribe(id,incoming=>{
        if(disposed)return;
        const normalized=normalizeState(incoming,INITIAL_STATE);
        const incomingSnapshot=JSON.stringify(normalized);
        if(incomingSnapshot===snapshotRef.current)return;
        snapshotRef.current=incomingSnapshot;setState(normalized);
      });
      if(process.env.NODE_ENV==='production'&&'serviceWorker'in navigator)void navigator.serviceWorker.register('/sw.js').catch(()=>undefined);
      setHydrated(true);
    })();
    return()=>{disposed=true;unsubscribe();};
  },[]);

  useEffect(()=>{
    if(!hydrated||!planeId||!storeRef.current)return;
    const snapshot=JSON.stringify(state);
    if(snapshot===snapshotRef.current)return;
    snapshotRef.current=snapshot;
    const timer=window.setTimeout(()=>{void storeRef.current?.save(planeId,state).catch(error=>console.warn('Plane save failed',error));},120);
    return()=>window.clearTimeout(timer);
  },[hydrated,planeId,state]);

  const joinGuest=useCallback((draft:JoinDraft)=>{
    if(!planeId||!storeRef.current)return;
    const guest:GuestIdentity={id:storeRef.current.anonymousId,nickname:draft.nickname,species:draft.species,color:draft.color,joinedAt:Date.now()};
    const identity:ViewerIdentity={...guest,role:'guest'};
    localStorage.setItem(viewerKeyRef.current||identityKey(planeId),JSON.stringify(identity));
    setViewer(identity);setState(value=>upsertGuest(value,guest));
  },[planeId]);

  const inviteUrl=useMemo(()=>{
    if(!planeId||typeof window==='undefined')return'';
    const access=splitPlaneAccessKey(planeId);
    const url=new URL('/',window.location.origin);url.searchParams.set('plane',access.id);url.searchParams.set('key',access.inviteToken);url.searchParams.set('join','1');return url.toString();
  },[planeId]);

  return {state,setState,hydrated,planeId,inviteUrl,viewer,needsGuestJoin:hydrated&&joinRequested&&!viewer,joinGuest,mode};
}

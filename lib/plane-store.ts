import { type RealtimeChannel, type SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseBrowserClient, hasSupabaseConfig } from './supabase-client';
import type { AppState, GuestIdentity } from './types';

export type StoreMode = 'realtime'|'local';
export type PlaneStore = {
  mode:StoreMode;
  anonymousId:string;
  load:(planeId:string)=>Promise<AppState|null>;
  save:(planeId:string,state:AppState)=>Promise<void>;
  subscribe:(planeId:string,onState:(state:AppState)=>void)=>()=>void;
};

const LOCAL_PREFIX='pluoto-plane-v1:';

export function createPlaneAccessKey() {return `${crypto.randomUUID()}.${crypto.randomUUID()}`;}
const UUID_PATTERN=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function splitPlaneAccessKey(accessKey:string) {
  const [id,inviteToken]=accessKey.split('.');
  if(!id||!inviteToken)throw new Error('Invalid Plane invite');
  return {id,inviteToken};
}
export function isRemotePlaneAccessKey(accessKey:string) {
  try {
    const {id,inviteToken}=splitPlaneAccessKey(accessKey);
    return UUID_PATTERN.test(id)&&UUID_PATTERN.test(inviteToken);
  } catch {return false;}
}

export function normalizeState(state:Partial<AppState>|null|undefined,fallback:AppState):AppState {
  return {
    people:Array.isArray(state?.people)?state.people:fallback.people,
    guests:Array.isArray(state?.guests)?state.guests:[],
    bubbleLog:Array.isArray(state?.bubbleLog)?state.bubbleLog:[],
    blocked:Array.isArray(state?.blocked)?state.blocked:[],
    completedOnboarding:Boolean(state?.completedOnboarding),
    requiresOnboarding:Boolean(state?.requiresOnboarding),
    accountRequired:Boolean(state?.accountRequired),
  };
}

export function upsertGuest(state:AppState,guest:GuestIdentity):AppState {
  return {...state,guests:[...state.guests.filter(item=>item.id!==guest.id),guest]};
}

function localAnonymousId() {
  const storageKey='pluoto-anonymous-device-v1';
  const existing=localStorage.getItem(storageKey);
  if(existing) return existing;
  const id=crypto.randomUUID();
  localStorage.setItem(storageKey,id);
  return id;
}

export function createLocalPlaneStore():PlaneStore {
  let channel:BroadcastChannel|null=null;
  return {
    mode:'local',
    anonymousId:localAnonymousId(),
    async load(planeId) {
      const value=localStorage.getItem(`${LOCAL_PREFIX}${planeId}`);
      return value?JSON.parse(value) as AppState:null;
    },
    async save(planeId,state) {
      localStorage.setItem(`${LOCAL_PREFIX}${planeId}`,JSON.stringify(state));
      channel?.postMessage(state);
    },
    subscribe(planeId,onState) {
      channel=new BroadcastChannel(`${LOCAL_PREFIX}${planeId}`);
      const receive=(event:MessageEvent<AppState>)=>onState(event.data);
      const storage=(event:StorageEvent)=>{if(event.key===`${LOCAL_PREFIX}${planeId}`&&event.newValue)onState(JSON.parse(event.newValue) as AppState);};
      channel.addEventListener('message',receive);
      window.addEventListener('storage',storage);
      return ()=>{channel?.removeEventListener('message',receive);channel?.close();channel=null;window.removeEventListener('storage',storage);};
    },
  };
}

async function remoteStore(client:SupabaseClient):Promise<PlaneStore> {
  const current=await client.auth.getSession();
  let anonymousId=current.data.session?.user.id;
  if(!anonymousId) {
    const result=await client.auth.signInAnonymously();
    if(result.error||!result.data.user) throw result.error??new Error('Anonymous identity unavailable');
    anonymousId=result.data.user.id;
  }
  let channel:RealtimeChannel|null=null;
  return {
    mode:'realtime',anonymousId,
    async load(planeId) {
      const access=splitPlaneAccessKey(planeId);
      const joined=await client.rpc('join_plane',{p_plane_id:access.id,p_invite_token:access.inviteToken});
      if(joined.error)throw joined.error;
      const result=await client.from('planes').select('state').eq('id',access.id).maybeSingle();
      if(result.error) throw result.error;
      return result.data?.state as AppState|null;
    },
    async save(planeId,state) {
      const access=splitPlaneAccessKey(planeId);
      const result=await client.rpc('save_plane',{p_plane_id:access.id,p_invite_token:access.inviteToken,p_state:state});
      if(result.error) throw result.error;
    },
    subscribe(planeId,onState) {
      const access=splitPlaneAccessKey(planeId);
      channel=client.channel(`plane:${access.id}`).on('postgres_changes',{event:'*',schema:'public',table:'planes',filter:`id=eq.${access.id}`},payload=>{
        const row=payload.new as {state?:AppState};
        if(row.state) onState(row.state);
      }).subscribe();
      return ()=>{if(channel)void client.removeChannel(channel);channel=null;};
    },
  };
}

/** Uses the authenticated Supabase session when configured; otherwise syncs local tabs. */
export async function createPlaneStore():Promise<PlaneStore> {
  if(hasSupabaseConfig()) {
    try { return await remoteStore(getSupabaseBrowserClient()); }
    catch(error) { console.warn('Realtime unavailable; using local Plane store.',error); }
  }
  return createLocalPlaneStore();
}

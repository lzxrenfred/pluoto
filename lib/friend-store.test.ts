import {describe,expect,it} from "vitest";
import type {AccountSnapshot} from "./account-store";
import {FriendError,LocalFriendStore,normalizeFriendCode} from "./friend-store";
import {DEMO_PEOPLE} from "./demo";

class MemoryStorage {
  private values=new Map<string,string>();
  getItem(key:string){return this.values.get(key)??null;}
  setItem(key:string,value:string){this.values.set(key,value);}
}

function account(id:string,nickname:string,plotX=0,plotY=0):AccountSnapshot {
  return {userId:id,email:`${nickname.toLowerCase()}@example.test`,person:{...DEMO_PEOPLE[0],id,nickname,owner:true,plotX,plotY},arrangement:[{personId:id,plotX,plotY}]};
}

function seed(storage:MemoryStorage,accounts:AccountSnapshot[]){storage.setItem("pluoto-accounts-v1",JSON.stringify(Object.fromEntries(accounts.map(item=>[item.email!,item]))));}

describe("friend persistence",()=>{
  it("normalizes readable friend codes",()=>{
    expect(normalizeFriendCode(" ab12 cd34 ")).toBe("AB12-CD34");
  });

  it("completes a personal invitation with independent persistent placements",async()=>{
    const storage=new MemoryStorage();
    const a=account("00000000-0000-4000-8000-00000000000a","Avery");
    const b=account("00000000-0000-4000-8000-00000000000b","Bailey");
    seed(storage,[a,b]);
    const storeA=new LocalFriendStore(storage);
    const storeB=new LocalFriendStore(storage);
    const inviteA=(await storeA.list(a)).invite;
    await storeB.list(b);

    expect((await storeB.preview(inviteA.token)).person.nickname).toBe("Avery");
    await storeB.acceptInvitation(b,inviteA.token);
    expect((await storeA.list(a)).friends.map(friend=>friend.preview.userId)).toEqual([b.userId]);
    expect((await storeB.list(b)).friends.map(friend=>friend.preview.userId)).toEqual([a.userId]);

    await storeA.setPlacement(a,b.userId,{plotX:1,plotY:0,hidden:false});
    await storeB.setPlacement(b,a.userId,{plotX:-2,plotY:3,hidden:false});
    expect((await new LocalFriendStore(storage).list(a)).friends[0].placement).toEqual({plotX:1,plotY:0,hidden:false});
    expect((await new LocalFriendStore(storage).list(b)).friends[0].placement).toEqual({plotX:-2,plotY:3,hidden:false});

    const edited={...a,person:{...a.person,ground:"sand" as const,houseColor:"blue" as const}};
    seed(storage,[edited,b]);
    const refreshed=await new LocalFriendStore(storage).list(b);
    expect(refreshed.friends[0].preview.person.ground).toBe("sand");
    expect(refreshed.friends[0].placement).toEqual({plotX:-2,plotY:3,hidden:false});
  });

  it("handles requests idempotently, prevents duplicates and supports decline/remove/block",async()=>{
    const storage=new MemoryStorage();
    const a=account("00000000-0000-4000-8000-00000000001a","Casey");
    const b=account("00000000-0000-4000-8000-00000000001b","Drew");
    seed(storage,[a,b]);
    const store=new LocalFriendStore(storage);
    const codeB=(await store.list(b)).invite.code;
    await store.list(a);
    await store.sendRequest(a,codeB.toLowerCase().replace("-"," "));
    await expect(store.sendRequest(a,codeB)).rejects.toMatchObject({code:"pending"} satisfies Partial<FriendError>);
    const request=(await store.list(b)).incoming[0];
    await store.acceptRequest(b,request.id);
    await store.acceptRequest(b,request.id);
    await expect(store.sendRequest(a,codeB)).rejects.toMatchObject({code:"already_friends"} satisfies Partial<FriendError>);

    await store.removeFriend(a,b.userId);
    await store.sendRequest(a,codeB);
    const second=(await store.list(b)).incoming[0];
    await store.declineRequest(b,second.id);
    expect((await store.list(b)).incoming).toHaveLength(0);

    await store.sendRequest(a,codeB);
    await store.blockUser(b,a.userId);
    await expect(store.sendRequest(a,codeB)).rejects.toMatchObject({code:"blocked"} satisfies Partial<FriendError>);
    expect((await store.list(a)).friends).toHaveLength(0);
  });

  it("rejects occupied placements and preserves hide separately from friendship",async()=>{
    const storage=new MemoryStorage();
    const a={...account("00000000-0000-4000-8000-00000000002a","Eli"),arrangement:[{personId:"00000000-0000-4000-8000-00000000002a",plotX:0,plotY:0},{personId:"demo",plotX:1,plotY:0}]};
    const b=account("00000000-0000-4000-8000-00000000002b","Fin");
    const c=account("00000000-0000-4000-8000-00000000002c","Gray");
    seed(storage,[a,b,c]);
    const store=new LocalFriendStore(storage);
    const inviteB=(await store.list(b)).invite;
    const inviteC=(await store.list(c)).invite;
    await store.list(a);
    await store.acceptInvitation(a,inviteB.token);
    await store.acceptInvitation(a,inviteC.token);
    await expect(store.setPlacement(a,b.userId,{plotX:1,plotY:0,hidden:false})).rejects.toMatchObject({code:"occupied"} satisfies Partial<FriendError>);
    await store.setPlacement(a,b.userId,{plotX:2,plotY:0,hidden:false});
    await expect(store.setPlacement(a,c.userId,{plotX:2,plotY:0,hidden:false})).rejects.toMatchObject({code:"occupied"} satisfies Partial<FriendError>);
    await store.setPlacement(a,b.userId,{plotX:2,plotY:0,hidden:true});
    expect((await store.list(a)).friends.find(friend=>friend.preview.userId===b.userId)?.placement?.hidden).toBe(true);
    expect((await store.list(a)).friends).toHaveLength(2);
  });

  it("distinguishes revoked and expired invitations",async()=>{
    const storage=new MemoryStorage();
    let now=1_000;
    const a=account("00000000-0000-4000-8000-00000000003a","Harper");
    seed(storage,[a]);
    const store=new LocalFriendStore(storage,()=>now);
    const old=(await store.list(a)).invite;
    await store.regenerateInvite(a);
    await expect(store.preview(old.token)).rejects.toMatchObject({code:"revoked"} satisfies Partial<FriendError>);
    const expiring=(await store.list(a)).invite;
    now+=91*86_400_000;
    await expect(store.preview(expiring.token)).rejects.toMatchObject({code:"expired"} satisfies Partial<FriendError>);
  });
});

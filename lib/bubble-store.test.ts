import {describe,expect,it} from "vitest";
import {BUBBLE_DURATION_MS,createBubbleStore} from "./bubble-store";
import type {AccountSnapshot} from "./account-store";
import {DEMO_PEOPLE} from "./demo";

class MemoryStorage {
  private values=new Map<string,string>();
  getItem(key:string){return this.values.get(key)??null;}
  setItem(key:string,value:string){this.values.set(key,value);}
  removeItem(key:string){this.values.delete(key);}
}
const actor:AccountSnapshot={userId:"owner",email:"owner@example.com",person:{...DEMO_PEOPLE[0],id:"owner"},arrangement:[]};

describe("Bubble lifecycle",()=>{
  it("keeps one active Bubble, resets its 24-hour expiry, and privately archives replacements",async()=>{
    let now=1_000;const realNow=Date.now;const store=createBubbleStore(new MemoryStorage()) as ReturnType<typeof createBubbleStore>;
    // Local mode is selected in tests because browser Supabase environment variables are absent.
    Object.defineProperty(Date,"now",{configurable:true,value:()=>now});
    try{
      const first=await store.publish(actor,"first thought");
      expect(first.active).not.toBeNull();
      expect(first.active!.expiresAt-first.active!.createdAt).toBe(BUBBLE_DURATION_MS);
      now+=5_000;const second=await store.publish(actor,"edited thought");
      expect(second.active?.text).toBe("edited thought");
      expect(second.archive).toMatchObject([{text:"first thought",reason:"replaced"}]);
      const cleared=await store.clear(actor);
      expect(cleared.active).toBeNull();
      expect(cleared.archive[0]).toMatchObject({text:"edited thought",reason:"cleared"});
    }finally{
      Object.defineProperty(Date,"now",{configurable:true,value:realNow});
    }
  });
});

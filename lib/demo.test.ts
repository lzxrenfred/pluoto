import {describe,expect,it} from "vitest";
import {DEMO_PEOPLE,isSeededDemoFixture,withoutSeededDemoFriends} from "./demo";

describe("legacy demo fixture cleanup",()=>{
  it("removes exact seeded friends without deleting a real user who shares their nickname",()=>{
    const owner=DEMO_PEOPLE[0];const fixture=DEMO_PEOPLE[1];
    const realSarah={...fixture,id:"8ea80b83-4241-4c25-a5bb-3df8e846df2c"};
    expect(isSeededDemoFixture(fixture)).toBe(true);
    expect(isSeededDemoFixture(realSarah)).toBe(false);
    expect(withoutSeededDemoFriends([owner,fixture,realSarah]).map(person=>person.id)).toEqual([owner.id,realSarah.id]);
  });
});

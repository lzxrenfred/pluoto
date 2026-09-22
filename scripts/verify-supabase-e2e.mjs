import fs from "node:fs";
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";

const projectRef = process.env.PLUOTO_SUPABASE_PROJECT_REF;
const keysFile = process.env.PLUOTO_SUPABASE_KEYS_FILE;
const keepFixtures = process.env.PLUOTO_KEEP_E2E === "1";
const fixtureOutput = process.env.PLUOTO_E2E_FIXTURE_OUTPUT;
if (!projectRef || !keysFile) throw new Error("Set PLUOTO_SUPABASE_PROJECT_REF and PLUOTO_SUPABASE_KEYS_FILE.");

const keys = JSON.parse(fs.readFileSync(keysFile, "utf8"));
const publishableKey = keys.find((entry) => entry.type === "publishable")?.api_key
  ?? keys.find((entry) => entry.name === "anon")?.api_key;
const secretKey = keys.find((entry) => entry.name === "service_role")?.api_key;
if (!publishableKey || !secretKey) throw new Error("Required Supabase API keys were not found.");

const url = `https://${projectRef}.supabase.co`;
const clientOptions = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };
const admin = createClient(url, secretKey, clientOptions);
const stamp = Date.now();
const password = `Pluoto-E2E-${stamp}!`;
const createdIds = [];

function person(id, nickname, species, ground = "grass") {
  return {
    id,
    nickname,
    species,
    color: species === "fox" ? "#e8794d" : species === "rabbit" ? "#f7eee5" : "#b88b68",
    accent: "#fff2df",
    accessory: "none",
    outfit: "none",
    ground,
    home: "cottage",
    houseColor: "coral",
    decorationPreset: "garden",
    pills: [],
    owner: true,
    scene: "new",
    plotX: 0,
    plotY: 0,
  };
}

async function must(result, label) {
  if (result.error) throw new Error(`${label}: ${result.error.message}`);
  return result.data;
}

async function fixture(label, nickname, species) {
  const email = `pluoto.e2e.${stamp}.${label}@example.com`;
  const created = await must(await admin.auth.admin.createUser({ email, password, email_confirm: true }), `create ${label}`);
  createdIds.push(created.user.id);
  const client = createClient(url, publishableKey, clientOptions);
  const session = await must(await client.auth.signInWithPassword({ email, password }), `sign in ${label}`);
  const snapshot = person(session.user.id, nickname, species);
  snapshot.pills = label === "a" ? ["curious", "coffee"] : label === "b" ? ["thoughtful", "design"] : ["observant"];
  await must(await client.from("profiles").insert({ id: snapshot.id, nickname, pending_invite: {} }), `profile ${label}`);
  await must(await client.from("character_customizations").insert({ user_id: snapshot.id, person_snapshot: snapshot }), `character ${label}`);
  await must(await client.from("lands").insert({ owner_id: snapshot.id, ground: snapshot.ground, home: snapshot.home, house_color: snapshot.houseColor, decoration_preset: snapshot.decorationPreset, person_snapshot: snapshot }), `land ${label}`);
  await must(await client.from("plane_arrangements").insert({ owner_id: snapshot.id, arrangement: [{ personId: snapshot.id, plotX: 0, plotY: 0 }] }), `arrangement ${label}`);
  await must(await client.from("profile_pills").insert(snapshot.pills.map(pill => ({ user_id: snapshot.id, pill }))), `pills ${label}`);
  return { email, id: snapshot.id, client };
}

async function expectRpcError(promise, token, label) {
  const result = await promise;
  assert(result.error, `${label}: expected an error`);
  assert.match(result.error.message, new RegExp(token, "i"), `${label}: unexpected error ${result.error.message}`);
}

try {
  const [a, b, c] = await Promise.all([
    fixture("a", "Ari", "fox"),
    fixture("b", "Bea", "rabbit"),
    fixture("c", "Cato", "cat"),
  ]);

  const aState = await must(await a.client.rpc("friend_state"), "A friend state");
  const bState = await must(await b.client.rpc("friend_state"), "B friend state");
  const cState = await must(await c.client.rpc("friend_state"), "C friend state");
  assert.match(aState.invite.code, /^[A-F0-9]{4}-[A-F0-9]{4}$/);

  const guest = createClient(url, publishableKey, clientOptions);
  const preview = await must(await guest.rpc("preview_friend_invite", { p_value: aState.invite.token }), "guest invite preview");
  assert.equal(preview.person.nickname, "Ari");
  assert.equal(preview.person.bubble, undefined);
  assert.equal(preview.person.pills.length, 0);

  await expectRpcError(a.client.rpc("send_friend_request", { p_code: aState.invite.code }), "SELF_INVITE", "self invite");
  await must(await a.client.rpc("send_friend_request", { p_code: bState.invite.code }), "A requests B");
  await expectRpcError(a.client.rpc("send_friend_request", { p_code: bState.invite.code }), "PENDING", "duplicate request");
  const bPending = await must(await b.client.rpc("friend_state"), "B pending state");
  assert.equal(bPending.incoming.length, 1);
  await must(await b.client.rpc("accept_friend_request", { p_request_id: bPending.incoming[0].id }), "B accepts A");

  let stateA = await must(await a.client.rpc("friend_state"), "A accepted state");
  let stateB = await must(await b.client.rpc("friend_state"), "B accepted state");
  assert.equal(stateA.friends.length, 1);
  assert.equal(stateB.friends.length, 1);
  assert.deepEqual(stateA.friends[0].preview.person.pills.sort(), ["design", "thoughtful"]);
  assert.deepEqual(stateB.friends[0].preview.person.pills.sort(), ["coffee", "curious"]);

  let bubbleEventResolve; let bubbleEventReject;
  const bubbleEvent = new Promise((resolve,reject)=>{bubbleEventResolve=resolve;bubbleEventReject=reject;});
  const bubbleChannel = b.client.channel(`bubble-e2e-${stamp}`).on("postgres_changes", { event: "*", schema: "public", table: "bubbles", filter: `owner_id=eq.${a.id}` }, payload => bubbleEventResolve(payload));
  await new Promise((resolve,reject)=>{const timeout=setTimeout(()=>reject(new Error("Bubble realtime subscription timed out")),8_000);bubbleChannel.subscribe(status=>{if(status==="SUBSCRIBED"){clearTimeout(timeout);resolve();}if(status==="CHANNEL_ERROR"){clearTimeout(timeout);bubbleEventReject(new Error("Bubble realtime channel failed"));reject(new Error("Bubble realtime channel failed"));}});});
  await must(await a.client.rpc("publish_bubble", { p_text: "Coffee after work?" }), "A publishes Bubble");
  await Promise.race([bubbleEvent,new Promise((_,reject)=>setTimeout(()=>reject(new Error("B did not receive A's Bubble realtime event")),8_000))]);
  await b.client.removeChannel(bubbleChannel);
  stateB = await must(await b.client.rpc("friend_state"), "B sees published Bubble");
  assert.equal(stateB.friends[0].preview.person.bubble, "Coffee after work?");
  assert.equal((await must(await guest.rpc("preview_friend_invite", { p_value: aState.invite.token }), "guest preview after Bubble")).person.bubble, undefined);
  assert.equal((await must(await c.client.from("bubbles").select("owner_id").eq("owner_id", a.id), "unrelated Bubble read")).length, 0);
  await must(await a.client.rpc("publish_bubble", { p_text: "Coffee tomorrow?" }), "A edits Bubble");
  const edited = await must(await a.client.rpc("bubble_state"), "A Bubble state after edit");
  assert.equal(edited.active.text, "Coffee tomorrow?");
  assert.equal(edited.archive[0].text, "Coffee after work?");
  assert.equal((await must(await c.client.from("bubble_archive").select("id").eq("owner_id", a.id), "unrelated archive read")).length, 0);
  const reconnectedB = createClient(url, publishableKey, clientOptions);
  await must(await reconnectedB.auth.signInWithPassword({ email: b.email, password }), "B reconnects");
  assert.equal((await must(await reconnectedB.rpc("friend_state"), "B sees edited Bubble after reconnect")).friends[0].preview.person.bubble, "Coffee tomorrow?");
  await must(await a.client.rpc("clear_bubble"), "A clears Bubble");
  assert.equal((await must(await reconnectedB.rpc("friend_state"), "B sees cleared Bubble")).friends[0].preview.person.bubble, undefined);
  assert.equal((await must(await a.client.rpc("bubble_state"), "A private archive after clear")).archive.length, 2);

  await must(await a.client.rpc("set_friend_placement", { p_friend_id: b.id, p_plot_x: 2, p_plot_y: 0, p_hidden: false }), "A places B");
  await must(await b.client.rpc("set_friend_placement", { p_friend_id: a.id, p_plot_x: -1, p_plot_y: 0, p_hidden: false }), "B places A");

  await must(await a.client.auth.signOut(), "A signs out");
  const refreshedA = createClient(url, publishableKey, clientOptions);
  await must(await refreshedA.auth.signInWithPassword({ email: a.email, password }), "A signs back in");
  stateA = await must(await refreshedA.rpc("friend_state"), "A restored state");
  assert.deepEqual(stateA.friends[0].placement, { plotX: 2, plotY: 0, hidden: false });

  await must(await refreshedA.from("lands").update({ ground: "earth", house_color: "blue" }).eq("owner_id", a.id), "A updates land");
  const visibleToB = await must(await b.client.from("lands").select("owner_id,ground,house_color").eq("owner_id", a.id).single(), "B reads A land");
  assert.equal(visibleToB.ground, "earth");
  assert.equal(visibleToB.house_color, "blue");

  const privateProfile = await must(await c.client.from("profiles").select("id").eq("id", a.id), "C reads A profile");
  const privateLand = await must(await c.client.from("lands").select("owner_id").eq("owner_id", a.id), "C reads A land");
  assert.equal(privateProfile.length, 0);
  assert.equal(privateLand.length, 0);
  await must(await c.client.from("lands").update({ ground: "sand" }).eq("owner_id", b.id), "C attempts B mutation");
  const unchangedB = await must(await b.client.from("lands").select("ground").eq("owner_id", b.id).single(), "B verifies own land");
  assert.equal(unchangedB.ground, "grass");

  await must(await refreshedA.rpc("set_friend_placement", { p_friend_id: b.id, p_plot_x: 2, p_plot_y: 0, p_hidden: true }), "A hides B");
  stateA = await must(await refreshedA.rpc("friend_state"), "A hidden state");
  assert.equal(stateA.friends[0].placement.hidden, true);
  await must(await refreshedA.rpc("remove_friend", { p_friend_id: b.id }), "A removes B");
  stateB = await must(await b.client.rpc("friend_state"), "B removed state");
  assert.equal(stateB.friends.length, 0);

  await must(await b.client.rpc("accept_personal_invite", { p_token: aState.invite.token }), "B accepts A personal invite");
  stateA = await must(await refreshedA.rpc("friend_state"), "A personal invite state");
  stateB = await must(await b.client.rpc("friend_state"), "B personal invite state");
  assert.equal(stateA.friends.length, 1);
  assert.equal(stateB.friends.length, 1);

  await must(await c.client.rpc("send_friend_request", { p_code: aState.invite.code }), "C requests A");
  const aWithC = await must(await refreshedA.rpc("friend_state"), "A sees C request");
  const fromC = aWithC.incoming.find((request) => request.from.userId === c.id);
  assert(fromC);
  await must(await refreshedA.rpc("decline_friend_request", { p_request_id: fromC.id }), "A declines C");
  assert.equal((await must(await c.client.rpc("friend_state"), "C declined state")).outgoing.length, 0);

  const regenerated = await must(await refreshedA.rpc("regenerate_friend_invite"), "A regenerates invite");
  assert.notEqual(regenerated.token, aState.invite.token);
  await expectRpcError(guest.rpc("preview_friend_invite", { p_value: aState.invite.token }), "REVOKED", "revoked invite");

  await must(await refreshedA.rpc("block_user", { p_user_id: b.id }), "A blocks B");
  await expectRpcError(b.client.rpc("send_friend_request", { p_code: regenerated.code }), "BLOCKED", "blocked request");

  console.log(JSON.stringify({
    auth: "password sign-in/sign-out/restoration verified",
    invitations: "guest preview, personal acceptance, regeneration/revocation verified",
    requests: "manual request, duplicate rejection, accept and decline verified",
    friendship: "mutual state, remove and block verified",
    placement: "independent placement, refresh restoration and hide verified",
    ownership: "friend land refresh and unrelated-user RLS denial verified",
    bubbles: "publish/edit/clear, realtime, reconnect, friend visibility, guest privacy and owner-only archive verified",
  }, null, 2));
  if (keepFixtures && fixtureOutput) {
    await must(await admin.from("user_blocks").delete().or(`and(blocker_id.eq.${a.id},blocked_id.eq.${b.id}),and(blocker_id.eq.${b.id},blocked_id.eq.${a.id})`), "reset visual block fixture");
    await must(await b.client.rpc("accept_personal_invite", { p_token: regenerated.token }), "restore visual friendship");
    await must(await refreshedA.rpc("set_friend_placement", { p_friend_id: b.id, p_plot_x: 1, p_plot_y: 0, p_hidden: false }), "restore visual A placement");
    await must(await b.client.rpc("set_friend_placement", { p_friend_id: a.id, p_plot_x: 0, p_plot_y: 1, p_hidden: false }), "restore visual B placement");
    await must(await refreshedA.rpc("publish_bubble", { p_text: "coffee after this?" }), "restore visual Bubble");
    fs.writeFileSync(fixtureOutput, JSON.stringify({ url, password, accounts: [a, b, c].map(({email,id})=>({email,id})) }), { mode: 0o600 });
  }
} finally {
  if (!keepFixtures) for (const id of createdIds) await admin.auth.admin.deleteUser(id);
}

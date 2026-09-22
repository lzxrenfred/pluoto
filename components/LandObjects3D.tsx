"use client";

import type { LandObject, Person } from "@/lib/types";
import { landObjectFootprint } from "@/lib/land-objects";
import { BenchModel, FlowerPatchModel, HouseModel, LampModel, MailboxModel, PathModel, RockClusterModel, ShrubModel, TableModel, TreeModel } from "./PlaneModels";

export function LandObjectModel({ object, person }: { object: LandObject; person: Person }) {
  if (object.modelId.startsWith("house.")) return <HouseModel home={object.modelId.slice(6) as Person["home"]} houseColor={person.houseColor}/>;
  if (object.modelId === "tree.round") return <TreeModel/>;
  if (object.modelId === "tree.tall") return <TreeModel variant="tall"/>;
  if (object.modelId === "tree.blossom") return <TreeModel variant="blossom"/>;
  if (object.modelId === "bush") return <ShrubModel/>;
  if (object.modelId === "flowers") return <FlowerPatchModel/>;
  if (object.modelId === "path") return <PathModel/>;
  if (object.modelId === "bench") return <BenchModel/>;
  if (object.modelId === "lamp") return <LampModel/>;
  if (object.modelId === "table") return <TableModel/>;
  if (object.modelId === "mailbox") return <MailboxModel/>;
  if (object.modelId === "rock.cluster") return <RockClusterModel/>;
  return null;
}

export function LandObjectInstance({ object, person, children }: { object: LandObject; person: Person; children?: React.ReactNode }) {
  const footprint = landObjectFootprint(object);
  return <group position={[object.tileX + footprint.width / 2, 0, object.tileY + footprint.height / 2]} rotation={[0, -object.rotation * Math.PI / 180, 0]}>
    <LandObjectModel object={object} person={person}/>{children}
  </group>;
}

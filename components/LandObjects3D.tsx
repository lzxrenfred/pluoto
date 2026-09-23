"use client";

import { useLayoutEffect, useRef } from "react";
import { Group, Mesh, Material } from "three";
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

export function LandObjectInstance({ object, person, children, ghost=false }: { object: LandObject; person: Person; children?: React.ReactNode; ghost?:boolean }) {
  const footprint = landObjectFootprint(object);
  const ref=useRef<Group>(null);
  useLayoutEffect(()=>{
    if(!ghost||!ref.current)return;
    const replacements:Array<{mesh:Mesh;original:Material|Material[];copies:Material[]}>=[];
    ref.current.traverse(node=>{if(!(node instanceof Mesh))return;const original=node.material as Material|Material[];const copies=(Array.isArray(original)?original:[original]).map(material=>{const copy=material.clone();copy.transparent=true;copy.opacity=(object.modelId==="path"||object.modelId==="flowers") ? .85 : .55;copy.depthWrite=false;return copy;});node.material=Array.isArray(original)?copies:copies[0];replacements.push({mesh:node,original,copies});});
    return()=>replacements.forEach(({mesh,original,copies})=>{mesh.material=original;copies.forEach(copy=>copy.dispose());});
  },[ghost,object.modelId,person]);
  return <group ref={ref} position={[object.tileX + footprint.width / 2, 0, object.tileY + footprint.height / 2]} rotation={[0, -object.rotation * Math.PI / 180, 0]}>
    <LandObjectModel object={object} person={person}/>{children}
  </group>;
}

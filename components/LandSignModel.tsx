"use client";

import { useEffect, useMemo } from "react";
import { RoundedBox } from "@react-three/drei";
import { CanvasTexture, LinearFilter, SRGBColorSpace } from "three";

export function LandSignModel({ nickname }: { nickname: string }) {
  const text = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 160;
    const context = canvas.getContext("2d")!;
    context.fillStyle = "#102b49";
    context.font = "800 82px Manrope, sans-serif";
    context.textAlign = "center";
    context.textBaseline = "middle";
    let label = nickname.trim() || "You";
    const originalLabel = label;
    while (label.length > 1 && context.measureText(label).width > 430) label = label.slice(0, -1);
    if (label !== originalLabel) label = `${label.trimEnd()}…`;
    context.fillText(label, 256, 82);
    const texture = new CanvasTexture(canvas);
    texture.colorSpace = SRGBColorSpace;
    texture.minFilter = LinearFilter;
    texture.needsUpdate = true;
    return texture;
  }, [nickname]);
  useEffect(() => () => text.dispose(), [text]);

  return <>
    {[-.31, .31].map(x => <mesh key={x} position={[x, .18, 0]} castShadow receiveShadow><boxGeometry args={[.075, .36, .075]}/><meshStandardMaterial color="#95633f" roughness={.92}/></mesh>)}
    <RoundedBox position={[0, .53, 0]} args={[1, .46, .12]} radius={.07} smoothness={3} renderOrder={20} castShadow receiveShadow><meshStandardMaterial color="#b88457" roughness={.9} transparent depthTest={false} depthWrite={false}/></RoundedBox>
    <RoundedBox position={[0, .53, .072]} args={[.9, .34, .035]} radius={.045} smoothness={3} renderOrder={21}><meshStandardMaterial color="#fff2d9" roughness={.88} transparent depthTest={false} depthWrite={false}/></RoundedBox>
    <mesh position={[0, .53, .094]} renderOrder={22}><planeGeometry args={[.82, .27]}/><meshBasicMaterial map={text} transparent toneMapped={false} depthTest={false} depthWrite={false}/></mesh>
  </>;
}

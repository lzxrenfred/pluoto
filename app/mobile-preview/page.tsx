"use client";
import {useEffect,useState} from 'react';

export default function MobilePreview() {
  const [target,setTarget]=useState('/');
  useEffect(()=>{const value=new URLSearchParams(window.location.search).get('target');if(value?.startsWith('/'))setTarget(value);},[]);
  return (
    <main style={{ width: "100vw", height: "100vh", display: "grid", placeItems: "center", background: "#dce7ec" }}>
      <iframe
        title="Pluoto mobile preview"
        src={target}
        style={{ width: "min(390px, calc((100vh - 24px) * .462))", height: "min(844px, calc(100vh - 24px))", border: 0, borderRadius: 28, boxShadow: "0 24px 70px rgba(20,40,60,.25)", background: "#93d5fb" }}
      />
    </main>
  );
}

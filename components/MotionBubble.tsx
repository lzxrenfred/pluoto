"use client";
import { useEffect, useState, type CSSProperties } from 'react';
import { MOTION, useMotionAllowed } from '@/lib/motion';

export function MotionBubble({ text, style }: { text?: string; style: CSSProperties }) {
  const allowed = useMotionAllowed();
  const [display, setDisplay] = useState(text);
  useEffect(() => {
    if (!allowed) { setDisplay(text); return; }
    if (text === display) return;
    const timer = setTimeout(() => setDisplay(text), display ? MOTION.bubbleMs : 0);
    return () => clearTimeout(timer);
  }, [text, display, allowed]);
  if (!display) return null;
  return <div className={`iso-bubble motion-bubble ${display !== text ? 'is-leaving' : ''}`} style={style}><span key={display}>{display}</span></div>;
}

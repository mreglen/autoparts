import React from 'react';

/** Мягкий indigo/violet фон для публичных лендингов (главная, отзывы). */
export default function PageAmbientBackground() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute right-0 top-1/4 h-[28rem] w-[28rem] rounded-full bg-indigo-400/15 blur-3xl" />
      <div className="absolute bottom-0 left-1/3 h-80 w-80 rounded-full bg-violet-400/10 blur-3xl" />
    </div>
  );
}

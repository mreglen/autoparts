import React from 'react';

/** Маркер на карте — самовывоз. */
export default function PickupIcon({ className = 'h-6 w-6' }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 21s6-5.2 6-10.5a6 6 0 10-12 0C6 15.8 12 21 12 21z" />
      <circle cx="12" cy="10.5" r="2.25" />
    </svg>
  );
}

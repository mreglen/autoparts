import React from 'react';
import { getOrderSourceMeta } from '../../utils/orderSourceMeta';

const SIZE_CLASSES = {
  sm: {
    box: 'h-5 w-5',
    img: 'h-3.5 w-3.5',
    text: 'text-xs',
  },
  md: {
    box: 'h-6 w-6',
    img: 'h-4 w-4',
    text: 'text-sm',
  },
};

export default function OrderSourceBadge({
  source,
  size = 'md',
  showLabel = false,
  className = '',
}) {
  const meta = getOrderSourceMeta(source);
  if (!meta) return null;

  const sizeClass = SIZE_CLASSES[size] || SIZE_CLASSES.md;

  return (
    <span
      className={`inline-flex items-center gap-1.5 ${className}`}
      title={meta.title}
    >
      <span
        className={`inline-flex shrink-0 items-center justify-center rounded-md border border-gray-200 bg-white ${sizeClass.box}`}
        aria-hidden
      >
        <img
          src={meta.logo}
          alt=""
          className={`${sizeClass.img} object-contain ${source === 'rossko' || source === 'new' ? 'scale-110' : ''}`}
        />
      </span>
      {showLabel && (
        <span className={`font-medium text-gray-700 ${sizeClass.text}`}>{meta.label}</span>
      )}
      <span className="sr-only">{meta.title}</span>
    </span>
  );
}

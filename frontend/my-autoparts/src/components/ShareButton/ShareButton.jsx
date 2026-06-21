import React, { useCallback, useEffect, useRef, useState } from 'react';
import { sharePage } from '../../utils/sharePage';

function ShareIcon({ className = 'h-5 w-5' }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
      />
    </svg>
  );
}

export default function ShareButton({
  url,
  title,
  text,
  label = 'Поделиться',
  showLabel = true,
  className = '',
  size = 'md',
}) {
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const noticeTimerRef = useRef(null);

  useEffect(() => () => {
    if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
  }, []);

  const showNotice = useCallback((message) => {
    setNotice(message);
    if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
    noticeTimerRef.current = setTimeout(() => setNotice(''), 2500);
  }, []);

  const handleClick = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (busy) return;

    setBusy(true);
    try {
      const result = await sharePage({ url, title, text });
      if (result.ok && result.method === 'clipboard') {
        showNotice('Ссылка скопирована');
      } else if (!result.ok && result.method === 'failed') {
        showNotice('Не удалось поделиться');
      }
    } finally {
      setBusy(false);
    }
  };

  const sizeClasses =
    size === 'sm'
      ? 'min-h-9 gap-1.5 px-2.5 py-1.5 text-xs'
      : 'min-h-10 gap-2 px-3 py-2 text-sm';

  return (
    <div className="relative inline-flex flex-col items-end">
      <button
        type="button"
        onClick={handleClick}
        disabled={busy}
        title={label}
        aria-label={label}
        className={`inline-flex items-center justify-center rounded-lg border border-gray-200 bg-white font-medium text-gray-700 shadow-sm transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700 disabled:opacity-60 ${sizeClasses} ${className}`}
      >
        <ShareIcon className={size === 'sm' ? 'h-4 w-4' : 'h-5 w-5'} />
        {showLabel ? <span>{busy ? '…' : label}</span> : null}
      </button>
      {notice ? (
        <span
          role="status"
          className="pointer-events-none absolute right-0 top-full z-10 mt-1 whitespace-nowrap rounded-md bg-gray-900 px-2 py-1 text-xs font-medium text-white shadow-lg"
        >
          {notice}
        </span>
      ) : null}
    </div>
  );
}

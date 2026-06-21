/**
 * Поделиться ссылкой: Web Share API или копирование в буфер.
 * @returns {{ ok: boolean, method: 'share'|'clipboard'|'cancelled'|'failed' }}
 */
export async function sharePage({ url, title, text }) {
  const shareUrl = (url || window.location.href).trim();
  const shareTitle = (title || document.title || '').trim();
  const shareText = (text || shareTitle || '').trim();

  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      await navigator.share({
        title: shareTitle || undefined,
        text: shareText || undefined,
        url: shareUrl,
      });
      return { ok: true, method: 'share' };
    } catch (err) {
      if (err?.name === 'AbortError') {
        return { ok: false, method: 'cancelled' };
      }
    }
  }

  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(shareUrl);
      return { ok: true, method: 'clipboard' };
    }
  } catch {
    // fallback below
  }

  try {
    const textarea = document.createElement('textarea');
    textarea.value = shareUrl;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    document.body.appendChild(textarea);
    textarea.select();
    const copied = document.execCommand('copy');
    document.body.removeChild(textarea);
    if (copied) {
      return { ok: true, method: 'clipboard' };
    }
  } catch {
    // ignore
  }

  return { ok: false, method: 'failed' };
}

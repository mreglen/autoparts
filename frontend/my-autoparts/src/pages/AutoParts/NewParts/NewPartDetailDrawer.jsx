import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { formatProductDisplayTitle } from '../../../utils/productDisplayName';
import { buildNewPartOpenPath } from '../../../utils/partRoutes';
import VinCatalogOffersTable from '../VinCatalog/VinCatalogOffersTable';

const CLOSE_ANIMATION_MS = 200;

function collectCrossParts(part) {
  let crossParts = part?.crosses?.Part;
  if (!crossParts) return [];
  return Array.isArray(crossParts) ? crossParts : [crossParts];
}

export default function NewPartDetailDrawer({ part, onClose, onOpenPart }) {
  const open = Boolean(part);
  const [isVisible, setIsVisible] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

  const brand = String(part?.brand || '').trim();
  const number = String(part?.partnumber || part?.article || '').trim();
  const name = formatProductDisplayTitle(brand, number, part?.name) || `${brand} ${number}`.trim();
  const detailHref = buildNewPartOpenPath({ brand, article: number });
  const imageUrl = part?.image_url || part?.image || null;
  const analogParts = useMemo(() => collectCrossParts(part), [part]);

  const requestClose = useCallback(() => {
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (open) {
      setIsVisible(true);
      setIsClosing(false);
      return undefined;
    }
    if (!isVisible) return undefined;
    setIsClosing(true);
    const timer = window.setTimeout(() => {
      setIsClosing(false);
      setIsVisible(false);
    }, CLOSE_ANIMATION_MS);
    return () => window.clearTimeout(timer);
  }, [open, isVisible]);

  useEffect(() => {
    if (!isVisible) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e) => {
      if (e.key === 'Escape') requestClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [isVisible, requestClose]);

  if (!isVisible) return null;

  const body = (
    <div className="fixed inset-0 z-[100] flex justify-end" role="dialog" aria-modal="true">
      <button
        type="button"
        aria-label="Закрыть"
        className={`absolute inset-0 bg-black/45 ${isClosing ? 'animate-fade-out' : 'animate-fade-in'}`}
        onClick={requestClose}
      />
      <div
        className={`relative flex h-full w-full max-w-[58rem] flex-col bg-white shadow-2xl sm:max-w-[58rem] lg:max-w-[66rem] ${
          isClosing ? 'animate-slide-out-right' : 'animate-slide-in-right'
        }`}
      >
        <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-4 py-3">
          <div className="flex min-w-0 items-start gap-3">
            {imageUrl ? (
              <div className="hidden h-16 w-16 flex-shrink-0 overflow-hidden rounded-lg border border-gray-100 bg-gray-50 sm:block">
                <img src={imageUrl} alt="" className="h-full w-full object-contain" />
              </div>
            ) : null}
            <div className="min-w-0">
              <h3 className="text-base font-semibold text-gray-900">{name}</h3>
              {number ? (
                <p className="mt-0.5 font-mono text-sm text-indigo-700">
                  {brand ? `${brand} · ` : ''}{number}
                </p>
              ) : null}
              <Link
                to={detailHref}
                className="mt-1 inline-block text-xs font-medium text-indigo-600 hover:text-indigo-800"
              >
                Полная карточка
              </Link>
            </div>
          </div>
          <button
            type="button"
            onClick={requestClose}
            className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-800"
            aria-label="Закрыть"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-4 py-4">
          <section>
            <h4 className="mb-2 text-sm font-semibold text-gray-900">Предложения</h4>
            <VinCatalogOffersTable
              parts={part ? [part] : []}
              emptyText="Нет предложений"
              onOpenPart={onOpenPart}
            />
          </section>

          {analogParts.length > 0 ? (
            <section>
              <h4 className="mb-2 text-sm font-semibold text-gray-900">
                Аналоги
                <span className="ml-2 text-xs font-normal text-gray-500">{analogParts.length}</span>
              </h4>
              <VinCatalogOffersTable
                parts={analogParts}
                sectionType="analog"
                emptyText="Нет аналогов"
                onOpenPart={onOpenPart}
              />
            </section>
          ) : null}
        </div>
      </div>
    </div>
  );

  return createPortal(body, document.body);
}

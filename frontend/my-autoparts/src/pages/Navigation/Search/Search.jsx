import React, { useState, useEffect, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import {
  clearSearch,
  fetchSearchResults,
  setSearchQuery as setGlobalSearchQuery,
} from '../../../redux/slices/RosskoSlice';
import { useDebouncedCallback } from '../../../hooks/useDebouncedCallback';
import { queryLooksLikeVin, normalizeVinForSearchOrNull } from '../../../utils/laximoVin';
import VinScanModal from '../../../components/VinScanner/VinScanModal';
import VinScanTriggerButton from '../../../components/VinScanner/VinScanTriggerButton';

function Search() {
  const [searchParams] = useSearchParams();
  const [searchTerm, setSearchTerm] = useState(searchParams.get('q') || '');
  const [isSearching, setIsSearching] = useState(false);
  const [vinScanOpen, setVinScanOpen] = useState(false);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const showNewAutoparts = useSelector((state) => state.publicInfo.showNewAutoparts !== false);
  const autopartsSearchPath = showNewAutoparts ? '/autoparts/new' : '/autoparts/used';
  const isOnUsedAutoparts = location.pathname.startsWith('/autoparts/used');
  const isOnNewAutoparts = location.pathname.startsWith('/autoparts/new');
  const showClear = Boolean(searchTerm.trim());

  useEffect(() => {
    setSearchTerm(searchParams.get('q') || searchParams.get('vin') || '');
  }, [searchParams]);

  const applyUsedQueryToUrl = useCallback((text) => {
    const params = new URLSearchParams(searchParams);
    params.delete('page');
    const trimmed = text.trim();
    if (trimmed) {
      params.set('q', trimmed);
      dispatch(setGlobalSearchQuery(trimmed));
    } else {
      params.delete('q');
      dispatch(setGlobalSearchQuery(''));
    }
    const basePath = location.pathname.startsWith('/autoparts/used')
      ? location.pathname
      : '/autoparts/used';
    const qs = params.toString();
    navigate(`${basePath}${qs ? `?${qs}` : ''}`, { replace: true });
  }, [searchParams, navigate, location.pathname, dispatch]);

  const debouncedUsedLiveSearch = useDebouncedCallback(applyUsedQueryToUrl, 320);

  const handleSearch = () => {
    const trimmedTerm = searchTerm.trim();
    if (!trimmedTerm || isSearching) return;

    const vin = normalizeVinForSearchOrNull(trimmedTerm);
    if (vin) {
      setIsSearching(false);
      navigate(`/autoparts/vin?vin=${encodeURIComponent(vin)}`);
      return;
    }

    setIsSearching(true);
    dispatch(setGlobalSearchQuery(trimmedTerm));

    if (isOnUsedAutoparts || !showNewAutoparts) {
      applyUsedQueryToUrl(trimmedTerm);
      setIsSearching(false);
      return;
    }

    dispatch(fetchSearchResults({ text: trimmedTerm }))
      .finally(() => {
        setIsSearching(false);
        navigate(`${autopartsSearchPath}?q=${encodeURIComponent(trimmedTerm)}`);
      });
  };

  const handleInputChange = (e) => {
    const value = e.target.value;
    setSearchTerm(value);

    if (queryLooksLikeVin(value.trim())) {
      return;
    }

    if (isOnUsedAutoparts || (!showNewAutoparts && location.pathname.startsWith('/autoparts'))) {
      debouncedUsedLiveSearch(value);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') handleSearch();
  };

  const handleVinScanConfirm = useCallback((vin) => {
    setVinScanOpen(false);
    setSearchTerm(vin);
    navigate(`/autoparts/vin?vin=${encodeURIComponent(vin)}`);
  }, [navigate]);

  const handleClear = useCallback(() => {
    setSearchTerm('');
    dispatch(setGlobalSearchQuery(''));

    if (isOnUsedAutoparts) {
      applyUsedQueryToUrl('');
      return;
    }

    if (isOnNewAutoparts) {
      const params = new URLSearchParams(searchParams);
      params.delete('q');
      params.delete('page');
      params.delete('vin_unavailable');
      const qs = params.toString();
      navigate(`/autoparts/new${qs ? `?${qs}` : ''}`, { replace: true });
      dispatch(clearSearch());
      return;
    }

    navigate(autopartsSearchPath, { replace: true });
    if (showNewAutoparts) {
      dispatch(clearSearch());
    }
  }, [
    applyUsedQueryToUrl,
    autopartsSearchPath,
    dispatch,
    isOnNewAutoparts,
    isOnUsedAutoparts,
    navigate,
    searchParams,
    showNewAutoparts,
  ]);

  const rightPadding = showClear ? 'pr-[5.75rem]' : 'pr-[4.25rem]';

  return (
    <>
      <div className="relative w-full">
        <input
          type="text"
          role="searchbox"
          inputMode="search"
          value={searchTerm}
          onChange={handleInputChange}
          onKeyPress={handleKeyPress}
          placeholder="Поиск: VIN, бренд, артикул или название"
          className={`block w-full rounded-full border-0 bg-surface-subtle py-2.5 pl-4 text-sm text-ink placeholder:text-ink-faint outline-none transition focus:bg-surface focus:ring-2 focus:ring-brand-500/20 ${rightPadding}`}
          disabled={isSearching}
        />
        {showClear ? (
          <button
            type="button"
            onClick={handleClear}
            disabled={isSearching}
            className="absolute inset-y-0 right-[4.25rem] flex items-center px-2 text-ink-faint transition hover:text-ink-soft disabled:opacity-50"
            aria-label="Очистить поиск"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        ) : null}
        <VinScanTriggerButton
          onClick={() => setVinScanOpen(true)}
          disabled={isSearching}
          className="absolute inset-y-0 right-10 px-2"
        />
        <button
          type="button"
          onClick={handleSearch}
          disabled={isSearching}
          className="absolute inset-y-0 right-0 flex items-center rounded-r-full px-3 text-ink-muted transition hover:text-brand-600 disabled:opacity-50"
          aria-label="Искать"
        >
          {isSearching ? (
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-brand-600 border-t-transparent" />
          ) : (
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          )}
        </button>
      </div>
      <VinScanModal
        open={vinScanOpen}
        onClose={() => setVinScanOpen(false)}
        onConfirm={handleVinScanConfirm}
      />
    </>
  );
}

export default Search;

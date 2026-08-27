import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSearchParams } from 'react-router-dom';
import { useDebouncedCallback } from '../../hooks/useDebouncedCallback';
import { navigateToVinCatalog } from '../../utils/vinCatalogNavigation';
import VinScanModal from '../VinScanner/VinScanModal';
import VinScanTriggerButton from '../VinScanner/VinScanTriggerButton';

export default function MobileCompactSearch({
    onSearch,
    onQueryChange,
    onClear,
    liveSearch = false,
    debounceMs = 320,
    placeholder = 'Поиск по названию, артикулу или VIN',
    className = '',
    sticky = true,
    inputClassName = '',
    enableVinScan = false,
    onVinScanConfirm,
}) {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const [searchTerm, setSearchTerm] = useState(searchParams.get('q') || '');
    const [isSearching, setIsSearching] = useState(false);
    const [vinScanOpen, setVinScanOpen] = useState(false);
    const showClear = Boolean(searchTerm.trim());

    const debouncedLiveSearch = useDebouncedCallback((value) => {
        if (onQueryChange) onQueryChange(value);
    }, debounceMs);

    useEffect(() => {
        setSearchTerm(searchParams.get('q') || '');
    }, [searchParams]);

    const handleSearch = async () => {
        const trimmedTerm = searchTerm.trim();
        if (!trimmedTerm || isSearching) return;

        setIsSearching(true);
        try {
            if (onSearch) {
                await onSearch(trimmedTerm);
            } else if (onQueryChange) {
                onQueryChange(trimmedTerm);
            }
        } finally {
            setIsSearching(false);
        }
    };

    const handleChange = (e) => {
        const value = e.target.value;
        setSearchTerm(value);
        if (liveSearch && onQueryChange) {
            debouncedLiveSearch(value);
        }
    };

    const handleClear = () => {
        setSearchTerm('');
        if (onClear) {
            onClear();
            return;
        }
        if (onQueryChange) {
            onQueryChange('');
            return;
        }
        if (onSearch) {
            onSearch('');
        }
    };

    const handleVinScanConfirm = (vin) => {
        setVinScanOpen(false);
        setSearchTerm(vin);
        if (onVinScanConfirm) {
            onVinScanConfirm(vin);
            return;
        }
        navigateToVinCatalog(navigate, vin);
    };

    const rightPadding = enableVinScan
        ? (showClear ? 'pr-[7rem]' : 'pr-[4.25rem]')
        : (showClear ? 'pr-[4.25rem]' : 'pr-11');

    return (
        <>
        <div className={`lg:hidden ${sticky ? 'sticky top-[var(--sg-mobile-header-h)] z-30' : ''} bg-gray-50 px-3 py-2 ${className}`}>
            <div className="relative">
                <svg
                    className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                    type="text"
                    role="searchbox"
                    inputMode="search"
                    value={searchTerm}
                    onChange={handleChange}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    placeholder={placeholder}
                    disabled={isSearching}
                    className={`h-11 w-full rounded-full border border-gray-200 bg-white pl-9 text-base text-gray-900 placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 ${rightPadding} ${inputClassName}`}
                />
                {showClear ? (
                    <button
                        type="button"
                        onClick={handleClear}
                        disabled={isSearching}
                        className={`absolute top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full text-gray-400 transition hover:text-gray-600 disabled:opacity-40 ${enableVinScan ? 'right-[5rem]' : 'right-11'}`}
                        aria-label="Очистить поиск"
                    >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                ) : null}
                {enableVinScan ? (
                    <VinScanTriggerButton
                        compact
                        onClick={() => setVinScanOpen(true)}
                        disabled={isSearching}
                        className="absolute right-9 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center"
                    />
                ) : null}
                <button
                    type="button"
                    onClick={handleSearch}
                    disabled={isSearching || !searchTerm.trim()}
                    className="absolute right-0 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full text-indigo-600 disabled:opacity-40"
                    aria-label="Найти"
                >
                    {isSearching ? (
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
                    ) : (
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                        </svg>
                    )}
                </button>
            </div>
        </div>
        {enableVinScan ? (
            <VinScanModal
                open={vinScanOpen}
                onClose={() => setVinScanOpen(false)}
                onConfirm={handleVinScanConfirm}
            />
        ) : null}
        </>
    );
}

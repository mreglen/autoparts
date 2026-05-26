import React, { useState, useRef, useEffect, useCallback } from 'react';
import { fetchAddressSuggestions } from '../../utils/dadataApi';

export default function DadataAddressInput({
  id,
  value = '',
  onChange,
  onBlur,
  onSuggestionSelect,
  placeholder = 'Город, улица, дом',
  className = '',
  hasError = false,
  locations,
  minLength = 3,
  multiline = false,
  rows = 2,
}) {
  const [suggestions, setSuggestions] = useState([]);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState(null);
  const inputRef = useRef(null);
  const wrapperRef = useRef(null);
  const requestIdRef = useRef(0);
  const debounceRef = useRef(null);

  const selectSuggestion = useCallback(
    (suggestion) => {
      onChange(suggestion.value);
      onSuggestionSelect?.(suggestion);
      setSuggestions([]);
      setHighlightedIndex(-1);
      inputRef.current?.focus();
    },
    [onChange, onSuggestionSelect]
  );

  const loadSuggestions = useCallback(
    async (query) => {
      if (!query || query.length < minLength) {
        setSuggestions([]);
        setHighlightedIndex(-1);
        setFetchError(null);
        return;
      }

      const requestId = ++requestIdRef.current;
      setLoading(true);
      setFetchError(null);
      try {
        const { suggestions: items, error } = await fetchAddressSuggestions(query, { locations });
        if (requestId !== requestIdRef.current) return;
        setSuggestions(items);
        setFetchError(error);
        setHighlightedIndex(-1);
      } catch {
        if (requestId !== requestIdRef.current) return;
        setSuggestions([]);
        setFetchError('Не удалось загрузить подсказки адреса');
        setHighlightedIndex(-1);
      } finally {
        if (requestId === requestIdRef.current) setLoading(false);
      }
    },
    [locations, minLength]
  );

  const handleInputChange = (e) => {
    const val = e.target.value;
    onChange(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => loadSuggestions(val), 300);
  };

  useEffect(
    () => () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    },
    []
  );

  const handleKeyDown = (e) => {
    if (multiline && e.key === 'Enter' && e.shiftKey) {
      return;
    }

    if (suggestions.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : prev));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : -1));
    } else if (e.key === 'Enter') {
      if (highlightedIndex >= 0) {
        e.preventDefault();
        selectSuggestion(suggestions[highlightedIndex]);
      } else {
        setSuggestions([]);
        setHighlightedIndex(-1);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setSuggestions([]);
      setHighlightedIndex(-1);
    }
  };

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setSuggestions([]);
        setHighlightedIndex(-1);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const inputProps = {
    ref: inputRef,
    id,
    value,
    onChange: handleInputChange,
    onKeyDown: handleKeyDown,
    onBlur,
    placeholder,
    autoComplete: 'off',
    role: 'combobox',
    'aria-expanded': suggestions.length > 0,
    'aria-autocomplete': 'list',
    'aria-controls': suggestions.length > 0 ? `${id}-suggestions` : undefined,
    className,
  };

  return (
    <div className="relative" ref={wrapperRef}>
      {multiline ? (
        <textarea {...inputProps} rows={rows} />
      ) : (
        <input {...inputProps} type="text" />
      )}
      {loading && suggestions.length === 0 && value.length >= minLength ? (
        <p className="mt-1 text-xs text-gray-400">Поиск адреса…</p>
      ) : null}
      {!loading && fetchError && value.length >= minLength ? (
        <p className="mt-1 text-xs text-amber-700">{fetchError}</p>
      ) : null}
      {suggestions.length > 0 && (
        <ul
          id={`${id}-suggestions`}
          role="listbox"
          className="absolute z-20 mt-1 max-h-52 w-full overflow-auto rounded-lg border border-gray-200 bg-white py-1 shadow-lg"
        >
          {suggestions.map((suggestion, index) => (
            <li
              key={`${suggestion.value}-${index}`}
              role="option"
              aria-selected={index === highlightedIndex}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => selectSuggestion(suggestion)}
              onMouseEnter={() => setHighlightedIndex(index)}
              className={`cursor-pointer px-3 py-2 text-sm ${
                index === highlightedIndex
                  ? 'bg-indigo-100 text-indigo-900'
                  : 'text-gray-800 hover:bg-gray-50'
              }`}
            >
              {suggestion.value}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

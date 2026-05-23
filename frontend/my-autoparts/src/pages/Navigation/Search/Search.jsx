import React, { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { fetchSearchResults, setSearchQuery as setGlobalSearchQuery } from '../../../redux/slices/RosskoSlice';
import { searchUsedParts } from '../../../redux/slices/ProductSlice';

function Search() {
  const [searchParams] = useSearchParams();
  const [searchTerm, setSearchTerm] = useState(searchParams.get('q') || '');
  const [isSearching, setIsSearching] = useState(false);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const showNewAutoparts = useSelector((state) => state.publicInfo.showNewAutoparts !== false);
  const autopartsSearchPath = showNewAutoparts ? '/autoparts/new' : '/autoparts/used';

  const handleSearch = () => {
    const trimmedTerm = searchTerm.trim();
    if (!trimmedTerm || isSearching) return;

    setIsSearching(true);
    dispatch(setGlobalSearchQuery(trimmedTerm));

    Promise.all([
      dispatch(searchUsedParts(trimmedTerm)),
      dispatch(fetchSearchResults({ text: trimmedTerm })),
    ])
      .then(() => setSearchTerm(trimmedTerm))
      .finally(() => {
        setIsSearching(false);
        navigate(`${autopartsSearchPath}?q=${encodeURIComponent(trimmedTerm)}`);
      });
  };

  const handleInputChange = (e) => {
    const value = e.target.value;
    setSearchTerm(value);
    const trimmedValue = value.trim();
    if (trimmedValue && !location.pathname.startsWith('/autoparts')) {
      navigate(`${autopartsSearchPath}?q=${encodeURIComponent(trimmedValue)}`);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') handleSearch();
  };

  return (
    <div className="relative w-full">
      <input
        type="search"
        value={searchTerm}
        onChange={handleInputChange}
        onKeyPress={handleKeyPress}
        placeholder="Поиск по названию, артикулу или VIN"
        className="block w-full rounded-xl border border-gray-200 bg-gray-50 py-2.5 pl-4 pr-11 text-sm text-gray-900 placeholder:text-gray-400 outline-none transition focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-500/20"
        disabled={isSearching}
      />
      <button
        type="button"
        onClick={handleSearch}
        disabled={isSearching}
        className="absolute inset-y-0 right-0 flex items-center rounded-r-xl px-3 text-gray-500 transition hover:text-indigo-600 disabled:opacity-50"
        aria-label="Искать"
      >
        {isSearching ? (
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
        ) : (
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        )}
      </button>
    </div>
  );
}

export default Search;

// src/components/Search.js
import React, { useState, useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { fetchSearchResults, setSearchQuery as setGlobalSearchQuery } from '../../../redux/slices/RosskoSlice';
import {
  searchAllProducts,
  searchUsedParts
} from '../../../redux/slices/ProductSlice';

function Search() {
  const [searchParams] = useSearchParams();
  const [searchTerm, setSearchTerm] = useState(searchParams.get('q') || '');
  const [isSearching, setIsSearching] = useState(false);
  const [lastSearchTerm, setLastSearchTerm] = useState('');
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const handleSearch = () => {
    const trimmedTerm = searchTerm.trim();
    if (!trimmedTerm || isSearching) return;

    setIsSearching(true);
    dispatch(setGlobalSearchQuery(trimmedTerm));

    // Выполняем все поиски параллельно
    Promise.all([
      dispatch(searchAllProducts(trimmedTerm)),
      dispatch(searchUsedParts(trimmedTerm)),
      dispatch(fetchSearchResults({ text: trimmedTerm }))
    ]).then(() => {
      setLastSearchTerm(trimmedTerm);
      // Сохраняем поисковый запрос в строке поиска вместо очистки
      setSearchTerm(trimmedTerm);
    }).finally(() => {
      setIsSearching(false);
      navigate(`/autoparts?q=${encodeURIComponent(trimmedTerm)}`);
    });
  };

  const handleInputChange = (e) => {
    const value = e.target.value;
    setSearchTerm(value);
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  return (
    <div className="relative w-full md:w-2/3 lg:w-1/2">
      <input
        type="text"
        value={searchTerm}
        onChange={handleInputChange}
        onKeyPress={handleKeyPress}
        placeholder="Поиск по названию, артикулу или VIN"
        className="block w-full p-4 md:p-3 pr-12 md:pr-10 rounded-lg border border-gray-300 bg-gray-100 focus:ring-blue-500 focus:border-blue-500 text-base md:text-sm"
        disabled={isSearching}
      />
      <div
        className="absolute inset-y-0 right-0 flex items-center mr-3 md:mr-4 cursor-pointer p-2 md:p-0"
        onClick={handleSearch}
      >
        {isSearching ? (
          <div className="w-6 h-6 md:w-6 md:h-6 flex items-center justify-center">
            <div className="animate-spin rounded-full h-5 w-5 md:h-4 md:w-4 border-b-2 border-blue-500"></div>
          </div>
        ) : (
          <img
            src="/img/search-interface-symbol-1.svg"
            alt="Поиск"
            className="w-7 h-7 md:w-6 md:h-6 text-gray-500 hover:text-blue-500 transition"
          />
        )}
      </div>
    </div>
  );
}

export default Search;
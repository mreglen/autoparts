// src/components/Search.js
import React, { useState } from 'react';
import { useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { fetchSearchResults } from '../../../redux/slices/RosskoSlice';
import {
  searchAllProducts
} from '../../../redux/slices/ProductSlice';

function Search() {
  const [searchTerm, setSearchTerm] = useState('');
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const handleSearch = () => {
    const trimmedTerm = searchTerm.trim();
    if (!trimmedTerm) return;

    dispatch(searchAllProducts(trimmedTerm));           
    dispatch(fetchSearchResults({ text: trimmedTerm }));  

    navigate('/autoparts');
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
        onChange={(e) => setSearchTerm(e.target.value)}
        onKeyPress={handleKeyPress}
        placeholder="Поиск по названию, артикулу или VIN"
        className="block w-full p-3 pr-10 rounded-lg border border-gray-300 bg-gray-100 focus:ring-blue-500 focus:border-blue-500 text-sm"
      />
      <div
        className="absolute inset-y-0 right-0 flex items-center mr-4 cursor-pointer"
        onClick={handleSearch}
      >
        <img
          src="/img/search-interface-symbol 1.svg"
          alt="Поиск"
          className="w-6 h-6 text-gray-500 hover:text-blue-500 transition"
        />
      </div>
    </div>
  );
}

export default Search;
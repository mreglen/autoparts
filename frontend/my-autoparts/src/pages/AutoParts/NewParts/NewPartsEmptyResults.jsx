import React from 'react';
import { Link } from 'react-router-dom';
import { QUICK_SEARCH_CHIPS } from './rosskoHelpers';

const NewPartsEmptyResults = ({ query, onSearch }) => (
  <div className="mt-12 sm:mt-16 flex flex-col items-center text-center max-w-2xl mx-auto px-4">
    <div className="bg-gray-100 p-6 rounded-full mb-8">
      <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 sm:h-12 sm:w-12 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
    </div>
    <h2 className="text-2xl font-bold text-gray-800 mb-3">Ничего не найдено</h2>
    <p className="text-gray-600 text-base leading-relaxed">
      По запросу <span className="font-semibold text-indigo-600">«{query}»</span> не найдено позиций.
    </p>
    <p className="text-sm text-gray-500 mt-4 max-w-md">
      Проверьте артикул, попробуйте другой бренд или поищите аналог.
    </p>
    <div className="flex flex-wrap gap-2 justify-center mt-6">
      {QUICK_SEARCH_CHIPS.slice(0, 5).map((chip) => (
        <button
          key={chip}
          type="button"
          onClick={() => onSearch(chip)}
          className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-indigo-50 rounded-full border border-gray-200"
        >
          {chip}
        </button>
      ))}
    </div>
    <Link
      to="/autoparts/used"
      className="mt-6 text-indigo-600 font-medium hover:text-indigo-800"
    >
      Посмотреть б/у запчасти →
    </Link>
  </div>
);

export default NewPartsEmptyResults;

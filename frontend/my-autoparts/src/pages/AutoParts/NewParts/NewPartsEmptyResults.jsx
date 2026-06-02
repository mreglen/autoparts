import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import UsedPartsSearchCount from './UsedPartsSearchCount';
import { fetchPopularNewPartQueries } from './popularQueriesApi';

const toSafeText = (value, fallback = '') => {
  if (typeof value === 'string') return value.trim() || fallback;
  if (typeof value === 'number') return String(value);
  if (!value) return fallback;
  if (typeof value === 'object') {
    if (typeof value.msg === 'string' && value.msg.trim()) return value.msg.trim();
    if (typeof value.input === 'string' && value.input.trim()) return value.input.trim();
    return fallback;
  }
  return fallback;
};

const NewPartsEmptyResults = ({ query, onSearch }) => {
  const [popularQueries, setPopularQueries] = useState([]);
  const [popularLoading, setPopularLoading] = useState(true);
  const safeQuery = toSafeText(query, '');

  useEffect(() => {
    let active = true;
    setPopularLoading(true);
    fetchPopularNewPartQueries(5)
      .then((items) => {
        if (active) setPopularQueries(items);
      })
      .finally(() => {
        if (active) setPopularLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="mt-12 sm:mt-16 flex flex-col items-center text-center max-w-2xl mx-auto px-4">
    <div className="bg-gray-100 p-6 rounded-full mb-8">
      <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 sm:h-12 sm:w-12 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
    </div>
    <h2 className="text-2xl font-bold text-gray-800 mb-3">Ничего не найдено</h2>
    <p className="text-gray-600 text-base leading-relaxed">
      По запросу <span className="font-semibold text-indigo-600">«{safeQuery}»</span> не найдено позиций.
    </p>
    <p className="text-sm text-gray-500 mt-4 max-w-md">
      Проверьте артикул, попробуйте другой бренд или поищите аналог.
    </p>
    <UsedPartsSearchCount query={safeQuery} variant="block" />
    <div className="flex flex-wrap gap-2 justify-center mt-6">
      {popularLoading && popularQueries.length === 0 ? (
        <span className="text-sm text-gray-400">загрузка…</span>
      ) : (
        popularQueries.map((chip) => (
          <button
            key={chip}
            type="button"
            onClick={() => onSearch(chip)}
            className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-indigo-50 rounded-full border border-gray-200"
          >
            {chip}
          </button>
        ))
      )}
    </div>
    <Link
      to="/autoparts/used"
      className="mt-6 text-indigo-600 font-medium hover:text-indigo-800"
    >
      Посмотреть б/у запчасти →
    </Link>
    </div>
  );
};

export default NewPartsEmptyResults;

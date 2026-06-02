import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchPopularNewPartQueries, getDefaultPopularNewPartQueries } from './popularQueriesApi';

const NewPartsLanding = ({ onSearch }) => {
  const [term, setTerm] = useState('');
  const [searching, setSearching] = useState(false);
  const [popularQueries, setPopularQueries] = useState(() => getDefaultPopularNewPartQueries(8));
  const [popularLoading, setPopularLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setPopularLoading(true);
    fetchPopularNewPartQueries(8)
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

  const runSearch = async (query) => {
    const trimmed = (query || term).trim();
    if (!trimmed || searching) return;
    setTerm(trimmed);
    setSearching(true);
    try {
      await onSearch(trimmed);
    } finally {
      setSearching(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-4xl px-3 sm:px-0">
      <section className="mb-6 text-center sm:mb-8">
        <h1 className="text-xl font-bold text-gray-900 sm:text-3xl">
          Новые запчасти с доставкой
        </h1>
      </section>

      <section className="mb-6 hidden sm:mb-8 sm:block">
        <div className="flex gap-2">
          <input
            type="text"
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && runSearch()}
            placeholder="Артикул, бренд или наименование"
            className="flex-1 rounded-lg border border-gray-300 px-4 py-3 text-base focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500"
            disabled={searching}
          />
          <button
            type="button"
            onClick={() => runSearch()}
            disabled={searching || !term.trim()}
            className="rounded-lg bg-indigo-600 px-6 py-3 font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {searching ? 'Поиск...' : 'Найти'}
          </button>
        </div>
      </section>

      <section className="mb-8">
        <p className="text-sm font-medium text-gray-700 mb-2">
          Популярные запросы
          {popularLoading && <span className="ml-2 text-xs font-normal text-gray-400">обновление…</span>}
        </p>
        <div className="flex flex-wrap gap-2">
          {popularQueries.map((chip) => (
            <button
              key={chip}
              type="button"
              onClick={() => runSearch(chip)}
              className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-indigo-50 hover:text-indigo-700 rounded-full border border-gray-200"
            >
              {chip}
            </button>
          ))}
        </div>
      </section>

      <p className="text-center text-sm text-gray-600">
        Нужна б/у запчасть с разборки?{' '}
        <Link to="/autoparts/used" className="text-indigo-600 font-medium hover:text-indigo-800">
          Смотреть б/у запчасти
        </Link>
      </p>
    </div>
  );
};

export default NewPartsLanding;

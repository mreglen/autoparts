import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { QUICK_SEARCH_CHIPS } from './rosskoHelpers';

const NewPartsLanding = ({ onSearch }) => {
  const [term, setTerm] = useState('');
  const [searching, setSearching] = useState(false);

  const runSearch = async (query) => {
    const trimmed = (query || term).trim();
    if (!trimmed || searching) return;
    setSearching(true);
    try {
      await onSearch(trimmed);
    } finally {
      setSearching(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-2 sm:px-0">
      <section className="text-center mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
          Новые запчасти с доставкой
        </h1>
      </section>

      <section className="mb-8">
        <div className="flex gap-2">
          <input
            type="text"
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && runSearch()}
            placeholder="Артикул, бренд или наименование"
            className="flex-1 border border-gray-300 rounded-lg px-4 py-3 text-base focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            disabled={searching}
          />
          <button
            type="button"
            onClick={() => runSearch()}
            disabled={searching || !term.trim()}
            className="px-6 py-3 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50"
          >
            {searching ? 'Поиск...' : 'Найти'}
          </button>
        </div>
      </section>

      <section className="mb-8">
        <p className="text-sm font-medium text-gray-700 mb-2">Популярные запросы</p>
        <div className="flex flex-wrap gap-2">
          {QUICK_SEARCH_CHIPS.map((chip) => (
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

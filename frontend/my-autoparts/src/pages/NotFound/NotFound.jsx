import React from 'react';
import { Link } from 'react-router-dom';
import { useAutopartsLandingPath } from '../../utils/autopartsPublic';

export default function NotFoundPage() {
  const autopartsPath = useAutopartsLandingPath();
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-white flex items-center justify-center px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full text-center">
        <div className="mb-8">
          <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-indigo-100 mb-6">
            <span className="text-5xl font-bold text-indigo-600">404</span>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-4">Страница не найдена</h1>
          <p className="text-lg text-gray-600 mb-8">
            Извините, но страница, которую вы ищете, не существует или была перемещена.
          </p>
        </div>
        
        <div className="space-y-4">
          <Link
            to="/"
            className="inline-block w-full sm:w-auto px-6 py-3 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition-colors duration-200 shadow-sm shadow-indigo-100 hover:shadow-md"
          >
            Вернуться на главную
          </Link>
          
          <div className="mt-8 pt-8 border-t border-gray-200">
            <h3 className="text-sm font-medium text-gray-900 mb-4">Попробуйте посетить:</h3>
            <div className="flex flex-col sm:flex-row gap-2 justify-center">
              <Link
                to={autopartsPath}
                className="px-4 py-2 text-indigo-600 hover:text-indigo-800 font-medium text-sm rounded-lg hover:bg-indigo-50 transition-colors"
              >
                Автозапчасти
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
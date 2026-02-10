import React from 'react';

export default function Help() {
  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-lg shadow-md p-6 sm:p-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-6">Помощь</h1>
          
          <div className="prose prose-gray max-w-none">
            <div className="mb-8">
              <h2 className="text-xl font-semibold text-gray-800 mb-4">Хотите такой же сайт?</h2>
              <p className="text-gray-700 mb-4">
                Или заинтересовали наши программные решения?
              </p>
              <p className="text-gray-700">
                Посетите наш сайт, где мы будем постепенно выносить наши программные решения, 
                чтобы вы смогли сделать так же.
              </p>
            </div>
            
            <div className="mt-8 p-6 bg-indigo-50 rounded-lg border border-indigo-100">
              <h3 className="text-lg font-medium text-indigo-800 mb-2">Наши программные решения</h3>
              <a 
                href="http://h607449173.nichost.ru" 
                target="_blank" 
                rel="noopener noreferrer"
                className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition-colors"
              >
                Перейти на сайт
                <svg 
                  className="ml-2 w-4 h-4" 
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24" 
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    strokeWidth={2} 
                    d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" 
                  />
                </svg>
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
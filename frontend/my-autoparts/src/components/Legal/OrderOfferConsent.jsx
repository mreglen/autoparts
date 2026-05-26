import React from 'react';
import { Link } from 'react-router-dom';

export default function OrderOfferConsent({ accepted, onChange, showError = false }) {
  return (
    <div className="space-y-2">
      <label
        className={`flex gap-3 text-sm text-gray-700 cursor-pointer ${showError && !accepted ? 'text-red-700' : ''}`}
      >
        <input
          type="checkbox"
          checked={accepted}
          onChange={(e) => onChange(e.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
        />
        <span>
          Принимаю условия{' '}
          <Link to="/offer" target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline">
            публичной оферты
          </Link>
        </span>
      </label>
      {showError && !accepted && (
        <p className="text-sm text-red-600">Для оформления заказа необходимо принять условия публичной оферты.</p>
      )}
    </div>
  );
}

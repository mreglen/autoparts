import React, { useId } from 'react';
import { Link } from 'react-router-dom';

export default function OrderOfferConsent({ accepted, onChange, showError = false }) {
  const checkboxId = useId();

  return (
    <div className="space-y-2">
      <div className={`flex gap-3 text-sm text-gray-700 ${showError && !accepted ? 'text-red-700' : ''}`}>
        <input
          id={checkboxId}
          type="checkbox"
          checked={accepted}
          onChange={(e) => onChange(e.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
        />
        <p className="leading-snug">
          <label htmlFor={checkboxId} className="cursor-pointer">
            Принимаю условия{' '}
          </label>
          <Link
            to="/offer"
            target="_blank"
            rel="noopener noreferrer"
            className="text-indigo-600 hover:underline"
          >
            публичной оферты
          </Link>
        </p>
      </div>
      {showError && !accepted && (
        <p className="text-sm text-red-600">Для оформления заказа необходимо принять условия публичной оферты.</p>
      )}
    </div>
  );
}

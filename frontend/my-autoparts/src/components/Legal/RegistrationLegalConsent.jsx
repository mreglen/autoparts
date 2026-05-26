import React from 'react';
import { Link } from 'react-router-dom';

export default function RegistrationLegalConsent({ accepted, onChange, showError = false }) {
  const hasError = showError && !accepted;

  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50/80 p-4">
      <label className={`flex gap-3 text-sm text-gray-700 cursor-pointer ${hasError ? 'text-red-700' : ''}`}>
        <input
          type="checkbox"
          checked={accepted}
          onChange={(e) => onChange(e.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
        />
        <span>
          Даю{' '}
          <Link
            to="/personal-data-consent"
            target="_blank"
            rel="noopener noreferrer"
            className="text-indigo-600 hover:underline"
          >
            согласие на обработку моих персональных данных
          </Link>{' '}
          и ознакомлен(а) с{' '}
          <Link to="/privacy" target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline">
            политикой конфиденциальности
          </Link>
        </span>
      </label>

      {hasError && (
        <p className="mt-2 text-sm text-red-600">
          Для регистрации необходимо дать согласие и подтвердить ознакомление с политикой конфиденциальности.
        </p>
      )}
    </div>
  );
}

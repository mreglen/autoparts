import React from 'react';
import { Link } from 'react-router-dom';

/**
 * Два обязательных согласия при регистрации (покупатель / продавец / модалки).
 * accepted = оба чекбокса отмечены.
 */
export default function RegistrationLegalConsent({
  acceptedPersonalData = false,
  acceptedPrivacyPolicy = false,
  onPersonalDataChange,
  onPrivacyPolicyChange,
  /** @deprecated используйте acceptedPersonalData + acceptedPrivacyPolicy */
  accepted,
  /** @deprecated используйте onPersonalDataChange / onPrivacyPolicyChange */
  onChange,
  showError = false,
}) {
  const personalChecked = onPersonalDataChange != null
    ? Boolean(acceptedPersonalData)
    : Boolean(accepted);
  const privacyChecked = onPrivacyPolicyChange != null
    ? Boolean(acceptedPrivacyPolicy)
    : Boolean(accepted);

  const bothAccepted = personalChecked && privacyChecked;
  const hasError = showError && !bothAccepted;

  const setPersonal = (checked) => {
    if (onPersonalDataChange) {
      onPersonalDataChange(checked);
      return;
    }
    if (onChange) onChange(checked && privacyChecked);
  };

  const setPrivacy = (checked) => {
    if (onPrivacyPolicyChange) {
      onPrivacyPolicyChange(checked);
      return;
    }
    if (onChange) onChange(personalChecked && checked);
  };

  const checkboxClass = `mt-0.5 h-4 w-4 shrink-0 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 ${
    hasError ? 'border-red-400' : ''
  }`;

  return (
    <div className={`rounded-xl border bg-gray-50/80 p-4 space-y-3 ${hasError ? 'border-red-300' : 'border-gray-200'}`}>
      <label className={`flex gap-3 text-sm cursor-pointer ${hasError ? 'text-red-700' : 'text-gray-700'}`}>
        <input
          type="checkbox"
          checked={personalChecked}
          onChange={(e) => setPersonal(e.target.checked)}
          className={checkboxClass}
        />
        <span>
          Даю{' '}
          <Link
            to="/personal-data-consent"
            target="_blank"
            rel="noopener noreferrer"
            className="text-indigo-600 hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            согласие на обработку моих персональных данных
          </Link>
        </span>
      </label>

      <label className={`flex gap-3 text-sm cursor-pointer ${hasError ? 'text-red-700' : 'text-gray-700'}`}>
        <input
          type="checkbox"
          checked={privacyChecked}
          onChange={(e) => setPrivacy(e.target.checked)}
          className={checkboxClass}
        />
        <span>
          Ознакомлен(а) с{' '}
          <Link
            to="/privacy"
            target="_blank"
            rel="noopener noreferrer"
            className="text-indigo-600 hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            политикой конфиденциальности
          </Link>
        </span>
      </label>

      {hasError && (
        <p className="text-sm text-red-600">
          Для регистрации необходимо дать согласие на обработку персональных данных
          и подтвердить ознакомление с политикой конфиденциальности.
        </p>
      )}
    </div>
  );
}

export function isRegistrationLegalConsentAccepted({
  acceptedPersonalData,
  acceptedPrivacyPolicy,
  accepted,
}) {
  if (acceptedPersonalData != null || acceptedPrivacyPolicy != null) {
    return Boolean(acceptedPersonalData) && Boolean(acceptedPrivacyPolicy);
  }
  return Boolean(accepted);
}

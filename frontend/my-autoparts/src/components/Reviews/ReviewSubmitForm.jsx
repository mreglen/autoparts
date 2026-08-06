import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { apiAxios } from '../../utils/apiClient';
import StarRatingInput from './StarRatingInput';
import { Button, Card } from '../UI';

function formatUserName(user) {
  if (!user) return '';
  return [user.last_name, user.first_name, user.patronymic].filter(Boolean).join(' ').trim();
}

function userRoleLabel(user) {
  if (!user) return '';
  if (user.is_seller) return 'Продавец';
  if (user.is_buyer) return 'Покупатель';
  return 'Пользователь';
}

export default function ReviewSubmitForm({ onSubmitted }) {
  const { user, token } = useSelector((state) => state.auth);
  const isAuthenticated = Boolean(token && user);

  const [rating, setRating] = useState(5);
  const [text, setText] = useState('');
  const [authorName, setAuthorName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const displayName = useMemo(() => formatUserName(user), [user]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    const trimmedText = text.trim();
    if (trimmedText.length < 10) {
      setError('Напишите отзыв не короче 10 символов');
      return;
    }

    if (!isAuthenticated && authorName.trim().length < 2) {
      setError('Укажите ваше ФИО');
      return;
    }

    setBusy(true);
    try {
      const body = {
        rating,
        text: trimmedText,
      };
      if (!isAuthenticated) {
        body.author_name = authorName.trim();
      }

      await apiAxios.post('/public/site-reviews', body);
      setSuccess(true);
      setText('');
      setRating(5);
      if (!isAuthenticated) {
        setAuthorName('');
      }
      onSubmitted?.();
    } catch (err) {
      const detail = err?.response?.data?.detail;
      setError(
        typeof detail === 'string'
          ? detail
          : Array.isArray(detail)
            ? detail.map((item) => item?.msg || item).join('; ')
            : 'Не удалось отправить отзыв. Попробуйте позже.'
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card as="section" padding="lg">
      <h2 className="text-xl font-bold text-ink">Оставить отзыв</h2>
      <p className="mt-2 text-sm text-ink-muted">
        {isAuthenticated
          ? 'Отзыв будет опубликован от вашего имени в профиле.'
          : 'Войдите в аккаунт или укажите ФИО — отзыв появится в списке после отправки.'}
      </p>

      {success && (
        <div className="mt-4 rounded-sg border border-success-100 bg-success-50 px-4 py-3 text-sm text-success-700">
          Спасибо! Ваш отзыв опубликован.
        </div>
      )}

      {error && (
        <div className="mt-4 rounded-sg border border-danger-100 bg-danger-50 px-4 py-3 text-sm text-danger-700">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="mt-6 space-y-5">
        <div>
          <span className="mb-2 block text-sm font-medium text-ink-soft">Ваша оценка</span>
          <StarRatingInput value={rating} onChange={setRating} disabled={busy} />
        </div>

        {isAuthenticated ? (
          <div className="rounded-sg border border-line bg-surface-muted px-4 py-3">
            <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">От имени</p>
            <p className="mt-1 text-sm font-semibold text-ink">{displayName || user.email}</p>
            <p className="text-xs text-ink-muted">{userRoleLabel(user)}</p>
          </div>
        ) : (
          <div>
            <label htmlFor="review-author-name" className="mb-1.5 block text-sm font-medium text-ink-soft">
              ФИО
            </label>
            <input
              id="review-author-name"
              type="text"
              value={authorName}
              onChange={(e) => setAuthorName(e.target.value)}
              disabled={busy}
              maxLength={120}
              placeholder="Иванов Иван Иванович"
              className="w-full rounded-sg border border-line bg-surface px-4 py-2.5 text-sm text-ink shadow-sg-sm transition focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 disabled:opacity-60"
            />
            <p className="mt-1.5 text-xs text-ink-muted">
              Или{' '}
              <Link to="/auth" className="font-medium text-brand-600 hover:text-brand-700">
                войдите
              </Link>
              , чтобы отзыв был привязан к аккаунту.
            </p>
          </div>
        )}

        <div>
          <label htmlFor="review-text" className="mb-1.5 block text-sm font-medium text-ink-soft">
            Текст отзыва
          </label>
          <textarea
            id="review-text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            disabled={busy}
            rows={5}
            maxLength={2000}
            placeholder="Расскажите, что понравилось или что можно улучшить…"
            className="w-full resize-y rounded-sg border border-line bg-surface px-4 py-3 text-sm leading-relaxed text-ink shadow-sg-sm transition focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 disabled:opacity-60"
          />
          <p className="mt-1 text-xs text-ink-faint">{text.length} / 2000</p>
        </div>

        <Button type="submit" disabled={busy} loading={busy}>
          {busy ? 'Отправка…' : 'Отправить отзыв'}
        </Button>
      </form>
    </Card>
  );
}

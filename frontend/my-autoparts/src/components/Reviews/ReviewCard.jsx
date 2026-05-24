import React from 'react';
import StarRating from './StarRating';
import {
  authorInitials,
  formatReviewDate,
  reviewSourceClass,
  reviewSourceLabel,
} from './reviewUtils';

export default function ReviewCard({ review, compact = false }) {
  const initials = authorInitials(review.author_name);
  const dateLabel = formatReviewDate(review.review_date);

  return (
    <article
      className={`relative flex h-full flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-md shadow-gray-900/5 ring-1 ring-gray-100/80 transition duration-300 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-indigo-900/10 ${
        compact ? 'p-5' : 'p-6'
      }`}
    >
      <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-indigo-500/5 blur-2xl" />
      <div className="relative flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-sm font-bold text-white shadow-md shadow-indigo-600/20">
          {initials}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate font-semibold text-gray-900">{review.author_name}</h3>
            <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1 ${reviewSourceClass(review.source)}`}>
              {reviewSourceLabel(review.source)}
            </span>
          </div>
          {review.author_role ? (
            <p className="text-xs text-gray-500">{review.author_role}</p>
          ) : null}
        </div>
      </div>

      <div className="relative mt-4 flex items-center justify-between gap-2">
        <StarRating value={review.rating} />
        {dateLabel ? <time className="text-xs text-gray-400">{dateLabel}</time> : null}
      </div>

      <p className={`relative mt-4 flex-1 leading-relaxed text-gray-600 ${compact ? 'text-sm line-clamp-4' : 'text-sm sm:text-base'}`}>
        «{review.text}»
      </p>
    </article>
  );
}

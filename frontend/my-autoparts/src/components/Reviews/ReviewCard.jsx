import React from 'react';
import StarRating from './StarRating';
import {
  authorInitials,
  formatReviewDate,
  reviewSourceClass,
  reviewSourceLabel,
} from './reviewUtils';
import { Card } from '../UI';

export default function ReviewCard({ review, compact = false }) {
  const initials = authorInitials(review.author_name);
  const dateLabel = formatReviewDate(review.review_date);

  return (
    <Card
      as="article"
      padding={compact ? 'sm' : 'md'}
      hover
      className="relative flex h-full flex-col"
    >
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-sg bg-brand-50 text-sm font-bold text-brand-700">
          {initials}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate font-semibold text-ink">{review.author_name}</h3>
            <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1 ${reviewSourceClass(review.source)}`}>
              {reviewSourceLabel(review.source)}
            </span>
          </div>
          {review.author_role ? (
            <p className="text-xs text-ink-muted">{review.author_role}</p>
          ) : null}
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between gap-2">
        <StarRating value={review.rating} />
        {dateLabel ? <time className="text-xs text-ink-faint">{dateLabel}</time> : null}
      </div>

      <p className={`mt-4 flex-1 leading-relaxed text-ink-soft ${compact ? 'text-sm line-clamp-4' : 'text-sm sm:text-base'}`}>
        «{review.text}»
      </p>
    </Card>
  );
}

import React from 'react';
import { Badge } from '../../UI';

export default function SeoLandingHero({ h1, statsText, total }) {
  return (
    <header className="mb-6 sm:mb-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl lg:text-4xl">{h1}</h1>
        {total > 0 ? (
          <Badge tone="brand" className="self-start sm:text-sm">
            {total} {total === 1 ? 'позиция' : total < 5 ? 'позиции' : 'позиций'}
          </Badge>
        ) : null}
      </div>
      {statsText ? <p className="mt-2 text-sm text-ink-muted sm:text-base">{statsText}</p> : null}
    </header>
  );
}

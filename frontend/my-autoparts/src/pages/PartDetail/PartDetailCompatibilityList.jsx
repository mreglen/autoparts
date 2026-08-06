import React from 'react';
import { Card } from '../../components/UI';
import NewPartHorizontalScroll from '../AutoParts/NewParts/NewPartHorizontalScroll';
import { buildVehicleSubtitle, buildVehicleTitle } from '../../utils/fitmentDisplay';

export default function PartDetailCompatibilityList({ vehicles = [] }) {
  const list = Array.isArray(vehicles) ? vehicles.filter(Boolean) : [];
  if (!list.length) return null;

  return (
    <div className="mt-4">
      <NewPartHorizontalScroll showHint={false}>
        <div className="flex gap-2 pb-0.5 pr-1">
          {list.map((vehicle) => {
            const key = `${vehicle.brand}|${vehicle.model}|${vehicle.generation}|${vehicle.source}`;
            const title = buildVehicleTitle(vehicle);
            const meta = buildVehicleSubtitle(vehicle);
            return (
              <Card
                key={key}
                padding="none"
                className="w-[11.5rem] shrink-0 p-3 sm:w-[13rem]"
              >
                <p className="text-sm font-semibold leading-snug text-ink">{title}</p>
                {meta ? (
                  <p className="mt-1 line-clamp-2 text-xs text-ink-muted">{meta}</p>
                ) : null}
              </Card>
            );
          })}
        </div>
      </NewPartHorizontalScroll>
    </div>
  );
}

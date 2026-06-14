import React from 'react';
import PageAmbientBackground from '../../PageAmbientBackground/PageAmbientBackground';

export default function SeoLandingShell({ children }) {
  return (
    <div className="relative pb-16">
      <PageAmbientBackground />
      <div className="mx-auto max-w-7xl px-4 pt-6 sm:px-6 lg:px-8">{children}</div>
    </div>
  );
}

module.exports = {
  ci: {
    collect: {
      staticDistDir: './build',
      url: ['/', '/autoparts/new', '/cart'],
      numberOfRuns: 2,
      settings: {
        emulatedFormFactor: 'mobile',
        screenEmulation: { mobile: true, width: 390, height: 844 },
      },
    },
    assert: {
      assertions: {
        'categories:performance': ['warn', { minScore: 0.65 }],
        'largest-contentful-paint': ['warn', { maxNumericValue: 4000 }],
        'cumulative-layout-shift': ['error', { maxNumericValue: 0.15 }],
        'total-byte-weight': ['warn', { maxNumericValue: 3500000 }],
        'installable-manifest': 'error',
        'service-worker': 'error',
      },
    },
    upload: {
      target: 'temporary-public-storage',
    },
  },
};

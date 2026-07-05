import http from 'k6/http';
import { check, sleep } from 'k6';

const mode = (__ENV.LOAD_TEST_MODE || 'hit').toLowerCase();
const base = __ENV.LOAD_TEST_BASE || 'https://127.0.0.1';
const host = __ENV.LOAD_TEST_HOST || 'svoygarage.ru';
const insecure = (__ENV.LOAD_TEST_INSECURE || 'true').toLowerCase() === 'true';

const catalogHitPath =
  '/server/api/catalog/products?page=1&page_size=20';
const partTypesPath = '/server/api/part-types/public';

const rampStages = [
  { duration: '1m', target: 50 },
  { duration: '2m', target: 50 },
  { duration: '1m', target: 100 },
  { duration: '2m', target: 100 },
  { duration: '1m', target: 150 },
  { duration: '2m', target: 150 },
  { duration: '1m', target: 200 },
  { duration: '2m', target: 200 },
  { duration: '30s', target: 0 },
];

export const options = {
  scenarios: {
    load: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: rampStages,
      gracefulRampDown: '15s',
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.05'],
    http_req_duration: ['p(95)<2000'],
  },
  insecureSkipTLSVerify: insecure,
  tags: { mode },
};

function requestParams() {
  return {
    headers: { Host: host },
    tags: { mode },
  };
}

function catalogUrl(hit) {
  if (mode === 'direct') {
    const path = hit
      ? '/api/catalog/products?page=1&page_size=20'
      : `/api/catalog/products?page=1&page_size=20&_bust=${__VU}-${__ITER}-${Date.now()}`;
    return `http://127.0.0.1:8080${path}`;
  }
  const path = hit
    ? catalogHitPath
    : `${catalogHitPath}&_bust=${__VU}-${__ITER}-${Date.now()}`;
  return `${base}${path}`;
}

function partTypesUrl() {
  if (mode === 'direct') {
    return 'http://127.0.0.1:8080/api/part-types/public';
  }
  return `${base}${partTypesPath}`;
}

function doGet(url) {
  const params = mode === 'direct' ? { tags: { mode } } : requestParams();
  return http.get(url, params);
}

export default function () {
  let res;

  if (mode === 'hit') {
    res = doGet(catalogUrl(true));
    check(res, {
      'status is 200': (r) => r.status === 200,
      'not 502/504/429': (r) => ![502, 504, 429].includes(r.status),
    });
  } else if (mode === 'miss') {
    res = doGet(catalogUrl(false));
    check(res, {
      'status is 200': (r) => r.status === 200,
      'not 502/504/429': (r) => ![502, 504, 429].includes(r.status),
    });
  } else if (mode === 'mixed') {
    const roll = Math.random();
    if (roll < 0.35) {
      res = doGet(partTypesUrl());
    } else if (roll < 0.7) {
      res = doGet(catalogUrl(true));
    } else {
      res = doGet(catalogUrl(false));
    }
    check(res, {
      'status is 200': (r) => r.status === 200,
      'not 502/504/429': (r) => ![502, 504, 429].includes(r.status),
    });
  } else if (mode === 'direct') {
    res = doGet(catalogUrl(true));
    check(res, {
      'status is 200': (r) => r.status === 200,
      'not 502/504': (r) => ![502, 504].includes(r.status),
    });
  } else {
    throw new Error(`Unknown LOAD_TEST_MODE: ${mode}`);
  }

  sleep(0.05);
}

export function handleSummary(data) {
  const m = data.metrics;
  const line = [
    `mode=${mode}`,
    `rps=${(m.http_reqs?.values?.rate || 0).toFixed(1)}`,
    `p50=${(m.http_req_duration?.values?.['p(50)'] || 0).toFixed(0)}ms`,
    `p95=${(m.http_req_duration?.values?.['p(95)'] || 0).toFixed(0)}ms`,
    `p99=${(m.http_req_duration?.values?.['p(99)'] || 0).toFixed(0)}ms`,
    `fail=${((m.http_req_failed?.values?.rate || 0) * 100).toFixed(2)}%`,
    `checks=${((m.checks?.values?.passes || 0) / Math.max(m.checks?.values?.passes + m.checks?.values?.fails || 1, 1) * 100).toFixed(1)}%`,
  ].join(' ');
  return {
    stdout: `\n=== K6_SUMMARY ${line} ===\n`,
    [`/tmp/k6-summary-${mode}.json`]: JSON.stringify(data, null, 2),
  };
}

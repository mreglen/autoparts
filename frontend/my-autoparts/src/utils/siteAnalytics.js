import { API_BASE, getAuthHeaders } from './apiClient';
import {
  getOutageRemainingMs,
  isApiOutage,
  registerApiFailure,
  registerApiSuccess,
} from './apiOutageGuard';
import { METRIKA_GOALS, reachMetrikaGoal } from './metrikaGoals';

const VISITOR_ID_KEY = 'site_analytics_visitor_id';
const ATTRIBUTION_KEY = 'site_analytics_attribution_sent';
const HEARTBEAT_INTERVAL_MS = 60000;
const FLUSH_INTERVAL_MS = 8000;
const MAX_QUEUE_SIZE = 40;
const MAX_QUEUE_TOTAL = 80;

let eventQueue = [];
let flushTimer = null;
let currentViewId = null;
let currentPath = null;
let pageEnteredAt = null;
let heartbeatTimer = null;
let cachedAttribution = null;
let analyticsPausedUntil = 0;

function generateId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

export function getVisitorId() {
  try {
    let id = localStorage.getItem(VISITOR_ID_KEY);
    if (!id) {
      id = generateId();
      localStorage.setItem(VISITOR_ID_KEY, id);
    }
    return id;
  } catch {
    return generateId();
  }
}

function captureAttribution() {
  if (cachedAttribution) return cachedAttribution;
  if (typeof window === 'undefined') {
    cachedAttribution = {};
    return cachedAttribution;
  }

  const params = new URLSearchParams(window.location.search || '');
  cachedAttribution = {
    referrer: document.referrer || '',
    utm_source: params.get('utm_source') || '',
    utm_medium: params.get('utm_medium') || '',
    utm_campaign: params.get('utm_campaign') || '',
  };
  return cachedAttribution;
}

function shouldAttachAttribution() {
  try {
    return !sessionStorage.getItem(ATTRIBUTION_KEY);
  } catch {
    return true;
  }
}

function markAttributionSent() {
  try {
    sessionStorage.setItem(ATTRIBUTION_KEY, '1');
  } catch {
    // ignore
  }
}

function buildPayload(events) {
  return JSON.stringify({ events });
}

function isAnalyticsPaused() {
  return Date.now() < analyticsPausedUntil || isApiOutage();
}

function pauseAnalytics(ms = 60000) {
  analyticsPausedUntil = Math.max(analyticsPausedUntil, Date.now() + ms);
}

function isTabVisible() {
  return typeof document === 'undefined' || document.visibilityState === 'visible';
}

function canSendViaFetch() {
  if (!API_BASE) return false;
  if (isAnalyticsPaused()) return false;
  if (!isTabVisible()) return false;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return false;
  return true;
}

function restoreBatch(batch) {
  if (!batch.length) return;
  eventQueue = [...batch, ...eventQueue].slice(0, MAX_QUEUE_TOTAL);
}

function sendEvents(events, useBeacon = false) {
  if (!events.length || !API_BASE) {
    return Promise.resolve(false);
  }

  const url = `${API_BASE}/public/analytics/events`;
  const body = buildPayload(events);
  const headers = {
    'Content-Type': 'application/json',
    ...getAuthHeaders(),
  };

  if (useBeacon && typeof navigator !== 'undefined' && navigator.sendBeacon) {
    const blob = new Blob([body], { type: 'application/json' });
    navigator.sendBeacon(url, blob);
    return Promise.resolve(true);
  }

  if (!canSendViaFetch()) {
    return Promise.resolve(false);
  }

  return fetch(url, {
    method: 'POST',
    headers,
    body,
    keepalive: true,
  })
    .then((response) => {
      if (response.ok) {
        registerApiSuccess();
        analyticsPausedUntil = 0;
        return true;
      }
      if ([502, 503, 504].includes(response.status)) {
        registerApiFailure(response.status);
        pauseAnalytics(60000);
      }
      return false;
    })
    .catch(() => {
      registerApiFailure(504);
      pauseAnalytics(60000);
      return false;
    });
}

function nextFlushDelayMs() {
  return Math.max(
    FLUSH_INTERVAL_MS,
    getOutageRemainingMs(),
    Math.max(0, analyticsPausedUntil - Date.now()),
  );
}

function scheduleFlush() {
  if (flushTimer) return;
  const delay = nextFlushDelayMs();
  flushTimer = window.setTimeout(() => {
    flushTimer = null;
    flushEvents(false);
  }, delay);
}

export function flushEvents(useBeacon = false) {
  if (!eventQueue.length) return;

  if (!useBeacon && !canSendViaFetch()) {
    scheduleFlush();
    return;
  }

  const batch = eventQueue.splice(0, MAX_QUEUE_SIZE);
  sendEvents(batch, useBeacon).then((ok) => {
    if (!ok && !useBeacon) {
      restoreBatch(batch);
      scheduleFlush();
      return;
    }
    if (eventQueue.length) {
      scheduleFlush();
    }
  });
}

function enqueue(event) {
  if (event.type === 'heartbeat' && isAnalyticsPaused()) {
    return;
  }
  if (eventQueue.length >= MAX_QUEUE_TOTAL) {
    eventQueue.shift();
  }
  eventQueue.push({
    ...event,
    visitor_id: getVisitorId(),
  });
  if (eventQueue.length >= MAX_QUEUE_SIZE) {
    flushEvents(false);
    return;
  }
  scheduleFlush();
}

function elapsedSincePageEnterSec() {
  if (!pageEnteredAt) return 0;
  return Math.max(0, Math.round((Date.now() - pageEnteredAt) / 1000));
}

function stopHeartbeat() {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
}

function startHeartbeat() {
  stopHeartbeat();
  heartbeatTimer = window.setInterval(() => {
    if (!isTabVisible() || !currentViewId || isAnalyticsPaused()) return;
    enqueue({
      type: 'heartbeat',
      view_id: currentViewId,
      duration_sec: Math.round(HEARTBEAT_INTERVAL_MS / 1000),
    });
  }, HEARTBEAT_INTERVAL_MS);
}

function closeCurrentPageView() {
  if (!currentViewId || !currentPath) return;
  const duration = elapsedSincePageEnterSec();
  if (duration > 0) {
    enqueue({
      type: 'heartbeat',
      view_id: currentViewId,
      duration_sec: duration,
    });
  }
}

export function trackPageView(path) {
  const nextPath = path || '/';
  if (currentPath && currentPath !== nextPath) {
    closeCurrentPageView();
  }

  currentPath = nextPath;
  currentViewId = generateId();
  pageEnteredAt = Date.now();

  const payload = {
    type: 'page_view',
    path: nextPath,
    view_id: currentViewId,
  };

  if (shouldAttachAttribution()) {
    const attribution = captureAttribution();
    payload.referrer = attribution.referrer || undefined;
    payload.utm_source = attribution.utm_source || undefined;
    payload.utm_medium = attribution.utm_medium || undefined;
    payload.utm_campaign = attribution.utm_campaign || undefined;
    markAttributionSent();
  }

  enqueue(payload);
  startHeartbeat();
}

export function trackConversion(eventName, options = {}) {
  if (!eventName) return;

  const path = options.path || currentPath || (typeof window !== 'undefined' ? `${location.pathname}${location.search || ''}` : '/');
  const productId = options.productId != null ? Number(options.productId) : undefined;
  const section = options.section || undefined;

  enqueue({
    type: 'conversion',
    event_name: eventName,
    path,
    product_id: Number.isFinite(productId) && productId > 0 ? productId : undefined,
  });

  reachMetrikaGoal(eventName, {
    product_id: productId,
    path,
    section,
  });

  flushEvents(false);
}

export const CONVERSION_EVENTS = METRIKA_GOALS;

export function trackFormField(formId, fieldName) {
  if (!formId || !fieldName) return;
  enqueue({
    type: 'form_field',
    form_id: formId,
    field_name: fieldName,
  });
}

export function trackFormSubmit(formId, filledFields = []) {
  if (!formId) return;
  const fields = Array.isArray(filledFields)
    ? filledFields.filter(Boolean)
    : [];
  enqueue({
    type: 'form_submit',
    form_id: formId,
    filled_fields: fields,
  });
  flushEvents(false);
}

export function initSiteAnalyticsLifecycle() {
  const handleVisibility = () => {
    if (document.visibilityState === 'hidden') {
      stopHeartbeat();
      closeCurrentPageView();
      flushEvents(true);
      return;
    }
    startHeartbeat();
    if (canSendViaFetch() && eventQueue.length) {
      scheduleFlush();
    }
  };

  const handleBeforeUnload = () => {
    closeCurrentPageView();
    flushEvents(true);
  };

  const handleOnline = () => {
    if (canSendViaFetch() && eventQueue.length) {
      scheduleFlush();
    }
  };

  window.addEventListener('visibilitychange', handleVisibility);
  window.addEventListener('pagehide', handleBeforeUnload);
  window.addEventListener('beforeunload', handleBeforeUnload);
  window.addEventListener('online', handleOnline);

  return () => {
    stopHeartbeat();
    window.removeEventListener('visibilitychange', handleVisibility);
    window.removeEventListener('pagehide', handleBeforeUnload);
    window.removeEventListener('beforeunload', handleBeforeUnload);
    window.removeEventListener('online', handleOnline);
  };
}

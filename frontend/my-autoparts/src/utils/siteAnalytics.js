import { API_BASE, getAuthHeaders } from './apiClient';

const VISITOR_ID_KEY = 'site_analytics_visitor_id';
const HEARTBEAT_INTERVAL_MS = 30000;
const FLUSH_INTERVAL_MS = 5000;
const MAX_QUEUE_SIZE = 40;

let eventQueue = [];
let flushTimer = null;
let currentViewId = null;
let currentPath = null;
let pageEnteredAt = null;
let heartbeatTimer = null;

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

function buildPayload(events) {
  return JSON.stringify({ events });
}

function sendEvents(events, useBeacon = false) {
  if (!events.length || !API_BASE) return;

  const url = `${API_BASE}/public/analytics/events`;
  const body = buildPayload(events);
  const headers = {
    'Content-Type': 'application/json',
    ...getAuthHeaders(),
  };

  if (useBeacon && navigator.sendBeacon) {
    const blob = new Blob([body], { type: 'application/json' });
    navigator.sendBeacon(url, blob);
    return;
  }

  fetch(url, {
    method: 'POST',
    headers,
    body,
    keepalive: true,
  }).catch(() => {});
}

function scheduleFlush() {
  if (flushTimer) return;
  flushTimer = window.setTimeout(() => {
    flushTimer = null;
    flushEvents(false);
  }, FLUSH_INTERVAL_MS);
}

export function flushEvents(useBeacon = false) {
  if (!eventQueue.length) return;
  const batch = eventQueue.splice(0, MAX_QUEUE_SIZE);
  sendEvents(batch, useBeacon);
  if (eventQueue.length) {
    scheduleFlush();
  }
}

function enqueue(event) {
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
    if (document.visibilityState !== 'visible' || !currentViewId) return;
    enqueue({
      type: 'heartbeat',
      view_id: currentViewId,
      duration_sec: 30,
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

  enqueue({
    type: 'page_view',
    path: nextPath,
    view_id: currentViewId,
  });

  startHeartbeat();
}

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
      closeCurrentPageView();
      flushEvents(true);
    }
  };

  const handleBeforeUnload = () => {
    closeCurrentPageView();
    flushEvents(true);
  };

  window.addEventListener('visibilitychange', handleVisibility);
  window.addEventListener('pagehide', handleBeforeUnload);
  window.addEventListener('beforeunload', handleBeforeUnload);

  return () => {
    stopHeartbeat();
    window.removeEventListener('visibilitychange', handleVisibility);
    window.removeEventListener('pagehide', handleBeforeUnload);
    window.removeEventListener('beforeunload', handleBeforeUnload);
  };
}

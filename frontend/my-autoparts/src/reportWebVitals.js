import { onCLS, onINP, onLCP } from 'web-vitals';

const METRIKA_ID = 107023580;

function sendToMetrika(metric) {
  if (typeof window === 'undefined') return;
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    return;
  }

  const paramKey = `web_vitals_${metric.name.toLowerCase()}`;
  const paramValue = Math.round(metric.name === 'CLS' ? metric.value * 1000 : metric.value);

  const send = () => {
    if (typeof window.ym !== 'function') return;
    window.ym(METRIKA_ID, 'params', { [paramKey]: paramValue });
    window.ym(METRIKA_ID, 'reachGoal', `cwv_${metric.name.toLowerCase()}`, {
      value: paramValue,
      rating: metric.rating,
    });
  };

  if (typeof window.ym === 'function') {
    send();
    return;
  }

  window.addEventListener('load', () => {
    window.setTimeout(send, 0);
  }, { once: true });
}

export default function reportWebVitals() {
  onLCP(sendToMetrika);
  onINP(sendToMetrika);
  onCLS(sendToMetrika);
}

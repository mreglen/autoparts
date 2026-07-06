import { YANDEX_WEBMASTER_COUNTER_HTML } from './yandexWebmasterBadge';

export default function HeaderYandexBadge() {
  return (
    <div
      className="flex items-center justify-center border-b border-gray-100 bg-gray-50/90 py-0.5"
      dangerouslySetInnerHTML={{ __html: YANDEX_WEBMASTER_COUNTER_HTML }}
    />
  );
}

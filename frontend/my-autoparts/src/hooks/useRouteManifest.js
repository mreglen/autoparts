import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const PLANNER_PATH = '/autoservice/planner';
const DEFAULT_MANIFEST = '/manifest.json';
const PLANNER_MANIFEST = '/manifest-planner.json';
const DEFAULT_APP_TITLE = 'Свой Гараж';
const PLANNER_APP_TITLE = 'Планировщик — Свой Гараж';

export default function useRouteManifest() {
  const { pathname } = useLocation();

  useEffect(() => {
    const isPlanner = pathname === PLANNER_PATH || pathname.startsWith(`${PLANNER_PATH}/`);
    const link = document.getElementById('manifest-link');
    if (link) link.href = isPlanner ? PLANNER_MANIFEST : DEFAULT_MANIFEST;
    const appleTitle = document.querySelector('meta[name="apple-mobile-web-app-title"]');
    if (appleTitle) appleTitle.content = isPlanner ? 'Планировщик' : DEFAULT_APP_TITLE;
    document.title = isPlanner ? PLANNER_APP_TITLE : DEFAULT_APP_TITLE;
  }, [pathname]);
}

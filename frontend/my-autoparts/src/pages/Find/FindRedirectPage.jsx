import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { apiAxiosUnauth } from '../../utils/apiClient';
import { buildFindSeo, PageSeoHelmet } from '../../utils/pageSeo';

export default function FindRedirectPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const q = (searchParams.get('q') || '').trim();
  const seo = buildFindSeo();

  useEffect(() => {
    if (!q) {
      navigate('/autoparts/used', { replace: true });
      return undefined;
    }

    let cancelled = false;

    (async () => {
      try {
        const { data } = await apiAxiosUnauth.get('/search-products/resolve-all', {
          params: { q },
        });
        if (cancelled) return;
        if (data?.redirect_path) {
          navigate(data.redirect_path, { replace: true });
          return;
        }
      } catch {
        // fallback below
      }
      if (!cancelled) {
        navigate(`/autoparts/used?q=${encodeURIComponent(q)}`, { replace: true });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [q, navigate]);

  return (
    <>
      <PageSeoHelmet seo={seo} />
      <div className="mx-auto max-w-7xl px-4 py-16 text-center text-gray-600">
        Ищем запчасть…
      </div>
    </>
  );
}

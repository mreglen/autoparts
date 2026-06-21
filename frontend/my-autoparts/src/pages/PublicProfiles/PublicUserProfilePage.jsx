import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { apiAxiosUnauth } from '../../utils/apiClient';
import PageAmbientBackground from '../../components/PageAmbientBackground/PageAmbientBackground';
import { createOrGetChatWithUser } from '../../redux/slices/ChatSlice';
import ProfileHeader from '../../components/PublicProfile/ProfileHeader';
import SellerStatsRow from '../../components/PublicProfile/SellerStatsRow';
import RecentListingsGrid from '../../components/PublicProfile/RecentListingsGrid';
import ProfileAboutBlock from '../../components/PublicProfile/ProfileAboutBlock';
import BuyerProfileBlock from '../../components/PublicProfile/BuyerProfileBlock';

function ProfileSkeleton() {
  return (
    <div className="mx-auto max-w-4xl animate-pulse px-4 py-10 sm:px-6">
      <div className="h-56 rounded-3xl bg-slate-200" />
      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <div className="h-28 rounded-2xl bg-slate-100" />
        <div className="h-28 rounded-2xl bg-slate-100" />
        <div className="h-28 rounded-2xl bg-slate-100" />
      </div>
      <div className="mt-4 h-48 rounded-2xl bg-slate-100" />
    </div>
  );
}

function canStartDirectChat(profile, currentUser) {
  if (!profile?.user_id || !currentUser?.id) return false;
  if (profile.user_id === currentUser.id) return false;
  if (profile.is_seller) return true;
  if (currentUser.is_seller && profile.is_buyer) return true;
  if (currentUser.is_seller) return true;
  return false;
}

function buildSellerSeo(profile, orgDetail) {
  const orgName = profile.organization_name || '';
  const count = profile.catalog_products_count ?? 0;
  const descriptionText = (orgDetail?.description || '').trim();
  const descriptionSnippet = descriptionText
    ? `${descriptionText.slice(0, 100)}${descriptionText.length > 100 ? '…' : ''}`
    : '';

  const title = orgName
    ? `Продавец ${profile.display_name} — ${orgName} | Свой Гараж`
    : `Продавец ${profile.display_name} | Свой Гараж`;

  const description = [
    count > 0 ? `${count} запчастей в наличии` : 'Профиль продавца',
    descriptionSnippet,
    'Свой Гараж — маркетплейс автозапчастей.',
  ]
    .filter(Boolean)
    .join('. ');

  return { title, description };
}

function buildBuyerSeo(profile) {
  return {
    title: `${profile.display_name} — покупатель | Свой Гараж`,
    description: `Публичный профиль ${profile.display_name} (ID ${profile.public_code}) на маркетплейсе Свой Гараж.`,
  };
}

export default function PublicUserProfilePage() {
  const { publicCode } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { user, token } = useSelector((state) => state.auth);
  const [profile, setProfile] = useState(null);
  const [orgDetail, setOrgDetail] = useState(null);
  const [catalogSummary, setCatalogSummary] = useState(null);
  const [recentProducts, setRecentProducts] = useState([]);
  const [productsTotal, setProductsTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [startingChat, setStartingChat] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const loadSellerExtras = async (sellerProfile) => {
      const orgId = sellerProfile.organization_id;
      if (!orgId) {
        setOrgDetail(null);
        setCatalogSummary(null);
        setRecentProducts([]);
        setProductsTotal(0);
        return;
      }

      const [orgRes, summaryRes, productsRes] = await Promise.allSettled([
        apiAxiosUnauth.get(`/public/organizations/${orgId}`),
        apiAxiosUnauth.get(`/public/organizations/${orgId}/catalog-summary`),
        apiAxiosUnauth.get('/catalog/products', {
          params: {
            organization_id: orgId,
            page: 1,
            page_size: 6,
            sort: 'created_at_desc',
          },
        }),
      ]);

      if (cancelled) return;

      setOrgDetail(orgRes.status === 'fulfilled' ? orgRes.value.data : null);
      setCatalogSummary(summaryRes.status === 'fulfilled' ? summaryRes.value.data : null);

      if (productsRes.status === 'fulfilled') {
        const data = productsRes.value.data || {};
        setRecentProducts(Array.isArray(data.items) ? data.items : []);
        setProductsTotal(Number(data.total) || 0);
      } else {
        setRecentProducts([]);
        setProductsTotal(0);
      }
    };

    const load = async () => {
      setLoading(true);
      setError(null);
      setOrgDetail(null);
      setCatalogSummary(null);
      setRecentProducts([]);
      setProductsTotal(0);

      try {
        const res = await apiAxiosUnauth.get(`/public/users/${encodeURIComponent(publicCode)}`);
        if (cancelled) return;

        const nextProfile = res.data;
        setProfile(nextProfile);

        if (nextProfile.is_seller) {
          await loadSellerExtras(nextProfile);
        }
      } catch (e) {
        if (!cancelled) {
          setProfile(null);
          const detail = e?.response?.data?.detail;
          setError(typeof detail === 'string' ? detail : 'Профиль не найден');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [publicCode]);

  const seo = useMemo(() => {
    if (!profile) return null;
    if (profile.is_seller) return buildSellerSeo(profile, orgDetail);
    return buildBuyerSeo(profile);
  }, [profile, orgDetail]);

  const showMessageButton = canStartDirectChat(profile, user);
  const isOwnProfile = profile?.user_id && user?.id && profile.user_id === user.id;

  const handleWriteMessage = async () => {
    if (!token) {
      navigate('/auth', { state: { from: `/users/${publicCode}` } });
      return;
    }
    if (!profile?.user_id || startingChat) return;

    setStartingChat(true);
    try {
      const chat = await dispatch(createOrGetChatWithUser(profile.user_id)).unwrap();
      navigate(`/chats?source=garage&chatId=${chat.id}`);
    } catch (e) {
      const msg = typeof e === 'string' ? e : 'Не удалось открыть чат';
      alert(msg);
    } finally {
      setStartingChat(false);
    }
  };

  if (loading) {
    return <ProfileSkeleton />;
  }

  if (error || !profile) {
    return (
      <div className="mx-auto max-w-lg px-4 py-20 text-center">
        <Helmet>
          <title>Профиль не найден — Свой Гараж</title>
          <meta name="robots" content="noindex, nofollow" />
        </Helmet>
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gray-100 text-2xl text-gray-400">
          ?
        </div>
        <h1 className="text-xl font-semibold text-gray-900">Профиль не найден</h1>
        <p className="mt-2 text-sm text-gray-500">{error || 'Проверьте ссылку или ID пользователя.'}</p>
        <Link
          to="/"
          className="mt-8 inline-flex rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700"
        >
          На главную
        </Link>
      </div>
    );
  }

  const accent = profile.is_seller
    ? 'from-indigo-600 via-indigo-700 to-violet-800'
    : 'from-teal-600 via-emerald-600 to-cyan-700';

  return (
    <div className="relative min-h-[70vh] pb-16">
      <PageAmbientBackground />
      <div className="relative mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:py-10">
        <Helmet>
          <title>{seo.title}</title>
          <meta name="description" content={seo.description} />
          <link rel="canonical" href={`${window.location.origin}/users/${profile.public_code}`} />
        </Helmet>

        <div className="overflow-hidden rounded-3xl border border-gray-200/80 bg-white shadow-xl shadow-gray-200/50">
          <ProfileHeader
            profile={profile}
            orgDetail={orgDetail}
            accent={accent}
            showMessageButton={showMessageButton}
            isOwnProfile={isOwnProfile}
            token={token}
            startingChat={startingChat}
            onWriteMessage={handleWriteMessage}
            publicCode={publicCode}
          />

          <div className="space-y-6 p-6 sm:p-8">
            {profile.is_seller ? (
              <>
                <SellerStatsRow
                  profile={profile}
                  orgDetail={orgDetail}
                  catalogSummary={catalogSummary}
                />

                {profile.organization_id ? (
                  <RecentListingsGrid
                    organizationId={profile.organization_id}
                    products={recentProducts}
                    total={productsTotal}
                  />
                ) : null}

                <ProfileAboutBlock
                  description={orgDetail?.description}
                  organizationName={profile.organization_name}
                />
              </>
            ) : (
              <BuyerProfileBlock />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

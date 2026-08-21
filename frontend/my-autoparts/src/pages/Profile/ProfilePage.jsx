import { useEffect, useMemo, useState, useRef } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { Link, useNavigate } from 'react-router-dom';
import { unwrapResult } from '@reduxjs/toolkit';

import { updateProfile, uploadAvatar, deleteAvatar } from '../../redux/slices/UserSlice';
import { logout, fetchProfile } from '../../redux/slices/AuthSlice';
import {
  fetchAutoserviceClientMe,
  selectIsAutoserviceClient,
} from '../../redux/slices/AutoserviceClientSlice';
import {
  canAccessAutoserviceClientMenu,
  selectAutoserviceOrganizationId,
  selectShowAutoservice,
} from '../../utils/autoservicePublic';
import { getCabinetMode } from '../../utils/cabinetMode';
import UserAvatar from '../../components/UserAvatar/UserAvatar';
import ConfirmationModal from '../../components/ConfirmationModal/ConfirmationModal';
import ChangePasswordModal from './ChangePasswordModal';
import OrganizationCard from './OrganizationCard';
import ProfileEngagementPreview from './ProfileEngagementPreview';
import { useAuthReady } from '../../hooks/useAuthReady';
import {
  ProfileBlock,
  ProfileQuickAction,
  ProfileRow,
  profileInputClass,
  profilePageShell,
  profilePrimaryBtn,
  profileSecondaryBtn,
} from './profileUi';

function ProfilePageSkeleton() {
  return (
    <div className={`${profilePageShell} animate-pulse`}>
      <div className="space-y-2">
        <div className="h-3 w-16 rounded bg-gray-100" />
        <div className="h-8 w-36 rounded-lg bg-gray-100" />
        <div className="h-4 w-48 rounded bg-gray-100" />
      </div>
      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <div className="flex items-center gap-4">
          <div className="h-16 w-16 rounded-full bg-gray-100" />
          <div className="flex-1 space-y-2">
            <div className="h-5 w-44 rounded-lg bg-gray-100" />
            <div className="h-4 w-28 rounded-lg bg-gray-100" />
            <div className="h-6 w-20 rounded-lg bg-gray-100" />
          </div>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-20 rounded-xl bg-gray-100" />
        ))}
      </div>
      <div className="rounded-xl border border-gray-200 bg-white">
        {[1, 2].map((i) => (
          <div key={i} className="border-b border-gray-100 px-4 py-4 last:border-0">
            <div className="h-4 w-36 rounded-lg bg-gray-100" />
          </div>
        ))}
      </div>
    </div>
  );
}

function getRoleLabel(user) {
  if (user?.is_admin) return 'Администратор';
  if (user?.is_seller) return 'Продавец';
  if (user?.is_employee) return 'Сотрудник';
  return 'Покупатель';
}

const IconBag = () => (
  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
  </svg>
);

const IconBell = () => (
  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
  </svg>
);

const IconParts = () => (
  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
  </svg>
);

const IconLock = () => (
  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
  </svg>
);

const IconCar = () => (
  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M8 17h8M5 11l1.5-4h11L19 11M6 17a1.5 1.5 0 103 0 1.5 1.5 0 00-3 0zm9 0a1.5 1.5 0 103 0 1.5 1.5 0 00-3 0zM5 11h14"
    />
  </svg>
);

const IconLogout = () => (
  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
  </svg>
);

export default function ProfilePage() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { user, isLoading, isReady } = useAuthReady();
  const isAutoserviceClient = useSelector(selectIsAutoserviceClient);
  const autoserviceClientStatus = useSelector((state) => state.autoserviceClient.status);
  const showAutoservice = useSelector(selectShowAutoservice);
  const autoserviceOrganizationId = useSelector(selectAutoserviceOrganizationId);
  const permissionCodes = useSelector((state) => state.auth.permissionCodes);
  const { loading: saving, avatarLoading, error: saveError } = useSelector((state) => state.user);

  const [isEditing, setIsEditing] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const avatarInputRef = useRef(null);

  const [formData, setFormData] = useState({
    last_name: '',
    first_name: '',
    patronymic: '',
  });

  useEffect(() => {
    if (user) {
      setFormData({
        last_name: user.last_name || '',
        first_name: user.first_name || '',
        patronymic: user.patronymic || '',
      });
    }
  }, [user?.last_name, user?.first_name, user?.patronymic]);

  useEffect(() => {
    if (!user || autoserviceClientStatus !== 'idle') return;
    dispatch(fetchAutoserviceClientMe());
  }, [dispatch, user, autoserviceClientStatus]);

  const displayName = useMemo(() => {
    if (!user) return '';
    const parts = [user.last_name, user.first_name, user.patronymic].filter(Boolean);
    return parts.join(' ').trim() || user.email || 'Пользователь';
  }, [user]);

  const profileSubtitle = useMemo(() => {
    if (!user) return '';
    if (user.phone) return user.phone;
    return user.email || '';
  }, [user]);

  if (isLoading) {
    return <ProfilePageSkeleton />;
  }

  if (isReady && !user) {
    return (
      <div className={profilePageShell}>
        <ProfileBlock padded>
          <div className="py-6 text-center">
            <p className="text-sm text-gray-900 sm:text-[15px]">Войдите в аккаунт</p>
            <Link to="/auth" className={`${profilePrimaryBtn} mt-5`}>
              Войти
            </Link>
          </div>
        </ProfileBlock>
      </div>
    );
  }

  const handleEdit = () => {
    setFormData({
      last_name: user.last_name || '',
      first_name: user.first_name || '',
      patronymic: user.patronymic || '',
    });
    setIsEditing(true);
  };

  const handleCancel = () => {
    setFormData({
      last_name: user.last_name || '',
      first_name: user.first_name || '',
      patronymic: user.patronymic || '',
    });
    setIsEditing(false);
  };

  const handleSave = async () => {
    try {
      unwrapResult(
        await dispatch(
          updateProfile({
            last_name: formData.last_name,
            first_name: formData.first_name,
            patronymic: formData.patronymic,
          }),
        ),
      );
      setIsEditing(false);
    } catch {
      /* ошибка в state.user.error */
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleAvatarFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      await dispatch(uploadAvatar(file)).unwrap();
      dispatch(fetchProfile());
    } catch {
      /* error in state.user.error */
    }
    e.target.value = '';
  };

  const handleDeleteAvatar = async () => {
    try {
      await dispatch(deleteAvatar()).unwrap();
      dispatch(fetchProfile());
    } catch {
      /* error in state.user.error */
    }
  };

  const showOrganization = Boolean(
    user.organization_id && (user.is_seller || user.is_director || user.is_employee),
  );

  const showMyParts = Boolean(
    user?.is_admin
    || user?.is_seller
    || (user?.is_employee && permissionCodes && permissionCodes.includes('my-parts')),
  );

  const canOpenGarage = Boolean(
    user
    && isAutoserviceClient
    && canAccessAutoserviceClientMenu(user, {
      showAutoservice,
      autoserviceOrganizationId,
      cabinetMode: getCabinetMode(user, { autoserviceOrganizationId }),
      organizationIsAutoservice: Boolean(user.organization_is_autoservice),
    }),
  );

  const quickActions = [
    canOpenGarage ? { to: '/garage', label: 'Мои авто', icon: <IconCar /> } : null,
    showMyParts ? { to: '/my-parts', label: 'Мои запчасти', icon: <IconParts /> } : null,
    { to: '/purchases/orders', label: 'Заказы', icon: <IconBag /> },
    { to: '/profile/notifications', label: 'Уведомления', icon: <IconBell /> },
  ].filter(Boolean);

  const quickActionsGridClass =
    quickActions.length >= 4
      ? 'grid-cols-2 sm:grid-cols-4'
      : quickActions.length === 3
        ? 'grid-cols-3'
        : 'grid-cols-2';

  return (
    <div className={profilePageShell}>
      {!isEditing ? (
        <ProfileBlock>
          <div className="flex items-center gap-4 px-4 py-4 sm:px-5 sm:py-5">
            <UserAvatar
              avatarUrl={user.avatar_url}
              firstName={user.first_name}
              lastName={user.last_name}
              size="lg"
              className="!h-16 !w-16 !rounded-full !text-xl"
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <p className="min-w-0 truncate text-lg font-semibold text-gray-900 sm:text-xl">{displayName}</p>
                <button
                  type="button"
                  onClick={handleEdit}
                  className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-gray-400 transition hover:bg-gray-100 hover:text-gray-700"
                  aria-label="Редактировать профиль"
                  title="Редактировать"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                    />
                  </svg>
                </button>
              </div>
              <p className="mt-0.5 truncate text-sm text-gray-500">{profileSubtitle}</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="inline-flex rounded-lg bg-indigo-50 px-2.5 py-0.5 text-xs font-medium text-indigo-700">
                  {getRoleLabel(user)}
                </span>
                {user.id != null ? (
                  <span className="font-mono text-xs text-gray-400" title="Идентификатор пользователя">
                    ID {user.id}
                  </span>
                ) : null}
              </div>
            </div>
          </div>
        </ProfileBlock>
      ) : (
        <ProfileBlock title="Личные данные" padded>
          {saveError ? (
            <div className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{saveError}</div>
          ) : null}

          <div className="mb-5 flex items-center gap-4">
            <button
              type="button"
              onClick={() => avatarInputRef.current?.click()}
              disabled={avatarLoading}
              className="relative shrink-0 rounded-full focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-60"
            >
              <UserAvatar
                avatarUrl={user.avatar_url}
                firstName={user.first_name}
                lastName={user.last_name}
                size="lg"
                className="!h-16 !w-16 !rounded-full !text-xl"
              />
              {avatarLoading ? (
                <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 text-xs text-white">
                  …
                </span>
              ) : null}
            </button>
            <div className="text-sm">
              <button
                type="button"
                onClick={() => avatarInputRef.current?.click()}
                className="font-medium text-indigo-600 hover:text-indigo-700"
              >
                Изменить фото
              </button>
              {user.avatar_url ? (
                <button
                  type="button"
                  onClick={handleDeleteAvatar}
                  disabled={avatarLoading}
                  className="mt-1 block text-gray-400 hover:text-red-600 disabled:opacity-50"
                >
                  Удалить
                </button>
              ) : null}
            </div>
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="hidden"
              onChange={handleAvatarFileChange}
            />
          </div>

          <div className="space-y-3">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">Фамилия</label>
              <input
                name="last_name"
                value={formData.last_name}
                onChange={handleChange}
                className={profileInputClass}
                autoComplete="family-name"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">Имя</label>
              <input
                name="first_name"
                value={formData.first_name}
                onChange={handleChange}
                className={profileInputClass}
                autoComplete="given-name"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">Отчество</label>
              <input
                name="patronymic"
                value={formData.patronymic}
                onChange={handleChange}
                className={profileInputClass}
              />
            </div>
          </div>

          <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button type="button" onClick={handleCancel} disabled={saving} className={profileSecondaryBtn}>
              Отмена
            </button>
            <button type="button" onClick={handleSave} disabled={saving} className={profilePrimaryBtn}>
              {saving ? 'Сохранение…' : 'Сохранить'}
            </button>
          </div>
        </ProfileBlock>
      )}

      <div className={`grid gap-2 sm:gap-3 ${quickActionsGridClass}`}>
        {quickActions.map((action) => (
          <ProfileQuickAction
            key={action.to}
            to={action.to}
            label={action.label}
            icon={action.icon}
          />
        ))}
      </div>

      {showOrganization ? <OrganizationCard orgId={user.organization_id} /> : null}

      <ProfileEngagementPreview />

      <ProfileBlock title="Аккаунт">
        <ProfileRow label="Сменить пароль" onClick={() => setShowPasswordModal(true)} icon={<IconLock />} />
        <ProfileRow
          label="Выйти"
          destructive
          onClick={() => setShowLogoutModal(true)}
          icon={<IconLogout />}
          trailing={null}
        />
      </ProfileBlock>

      <ChangePasswordModal isOpen={showPasswordModal} onClose={() => setShowPasswordModal(false)} />

      <ConfirmationModal
        isOpen={showLogoutModal}
        onClose={() => setShowLogoutModal(false)}
        onConfirm={() => {
          setShowLogoutModal(false);
          dispatch(logout());
          navigate('/', { replace: true });
        }}
        title="Выход из аккаунта"
        message="Вы действительно хотите выйти?"
        confirmText="Выйти"
        cancelText="Отмена"
        danger
      />
    </div>
  );
}

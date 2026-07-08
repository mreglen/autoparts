import { useEffect, useMemo, useState, useRef } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { Link, useNavigate } from 'react-router-dom';
import { unwrapResult } from '@reduxjs/toolkit';

import { updateProfile, uploadAvatar, deleteAvatar } from '../../redux/slices/UserSlice';
import { logout, fetchProfile } from '../../redux/slices/AuthSlice';
import UserAvatar from '../../components/UserAvatar/UserAvatar';
import ConfirmationModal from '../../components/ConfirmationModal/ConfirmationModal';
import ChangePasswordModal from './ChangePasswordModal';
import OrganizationCard from './OrganizationCard';
import ProfileEngagementPreview from './ProfileEngagementPreview';
import { useAuthReady } from '../../hooks/useAuthReady';
import {
  ChevronRight,
  ProfileBlock,
  ProfileRow,
  profileInputClass,
  profilePageShell,
  profilePrimaryBtn,
  profileSecondaryBtn,
} from './profileUi';

function ProfilePageSkeleton() {
  return (
    <div className={`${profilePageShell} animate-pulse`}>
      <div className="bg-white px-4 py-5 sm:rounded-xl">
        <div className="flex items-center gap-3">
          <div className="h-14 w-14 rounded-full bg-gray-200" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-40 rounded bg-gray-200" />
            <div className="h-3 w-28 rounded bg-gray-100" />
          </div>
        </div>
      </div>
      <div className="bg-white sm:rounded-xl">
        {[1, 2, 3].map((i) => (
          <div key={i} className="border-b border-gray-100 px-4 py-4 last:border-0">
            <div className="h-4 w-32 rounded bg-gray-100" />
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
  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
  </svg>
);

const IconBell = () => (
  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
  </svg>
);

const IconParts = () => (
  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
  </svg>
);

export default function ProfilePage() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { user, isLoading, isReady } = useAuthReady();
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
        <ProfileBlock>
          <div className="px-4 py-10 text-center">
            <p className="text-[15px] text-gray-900">Войдите в аккаунт</p>
            <Link
              to="/auth"
              className={`${profilePrimaryBtn} mt-5`}
            >
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

  return (
    <div className={profilePageShell}>
      {!isEditing ? (
        <ProfileBlock>
          <button
            type="button"
            onClick={handleEdit}
            className="flex w-full items-center gap-3 px-4 py-4 text-left hover:bg-gray-50 active:bg-gray-100"
          >
            <div className="relative shrink-0">
              <UserAvatar
                avatarUrl={user.avatar_url}
                firstName={user.first_name}
                lastName={user.last_name}
                size="lg"
                className="!rounded-full"
              />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-lg font-medium text-gray-900">{displayName}</p>
              <p className="truncate text-sm text-gray-500">{profileSubtitle}</p>
              <p className="mt-1 text-xs text-gray-400">{getRoleLabel(user)}</p>
            </div>
            <ChevronRight />
          </button>
        </ProfileBlock>
      ) : (
        <ProfileBlock title="Личные данные">
          <div className="px-4 py-4">
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
                  className="!rounded-full"
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
                <label className="mb-1 block text-sm text-gray-500">Фамилия</label>
                <input
                  name="last_name"
                  value={formData.last_name}
                  onChange={handleChange}
                  className={profileInputClass}
                  autoComplete="family-name"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-gray-500">Имя</label>
                <input
                  name="first_name"
                  value={formData.first_name}
                  onChange={handleChange}
                  className={profileInputClass}
                  autoComplete="given-name"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-gray-500">Отчество</label>
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
          </div>
        </ProfileBlock>
      )}

      <ProfileBlock>
        {showMyParts ? (
          <ProfileRow to="/my-parts" label="Мои запчасти" icon={<IconParts />} />
        ) : null}
        <ProfileRow to="/purchases/orders" label="Заказы" icon={<IconBag />} />
        <ProfileRow to="/profile/notifications" label="Уведомления" icon={<IconBell />} />
      </ProfileBlock>

      {showOrganization ? <OrganizationCard orgId={user.organization_id} /> : null}

      <ProfileEngagementPreview />

      <ProfileBlock>
        <ProfileRow label="Сменить пароль" onClick={() => setShowPasswordModal(true)} />
        <ProfileRow
          label="Выйти"
          destructive
          onClick={() => setShowLogoutModal(true)}
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

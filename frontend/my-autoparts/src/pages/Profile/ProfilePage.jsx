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
import { useAuthReady } from '../../hooks/useAuthReady';

function ProfilePageSkeleton() {
    return (
        <div className="mt-4 animate-pulse space-y-6 px-4 sm:mt-5 sm:px-0">
            <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6">
                <div className="flex items-center gap-4">
                    <div className="h-20 w-20 shrink-0 rounded-2xl bg-gray-200" />
                    <div className="min-w-0 flex-1 space-y-2.5">
                        <div className="h-6 w-48 max-w-full rounded-lg bg-gray-200" />
                        <div className="h-4 w-56 max-w-full rounded bg-gray-100" />
                        <div className="flex gap-2">
                            <div className="h-5 w-24 rounded-full bg-gray-100" />
                            <div className="h-5 w-20 rounded-full bg-gray-100" />
                        </div>
                    </div>
                    <div className="flex shrink-0 gap-2">
                        <div className="h-10 w-10 rounded-xl bg-gray-200" />
                        <div className="h-10 w-10 rounded-xl bg-gray-200" />
                        <div className="h-10 w-10 rounded-xl bg-gray-200" />
                    </div>
                </div>
            </div>
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <section className="space-y-3 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
                    {[1, 2, 3].map((i) => (
                        <div key={i} className="flex gap-3 rounded-xl border border-gray-100 bg-gray-50/60 px-4 py-3">
                            <div className="h-9 w-9 shrink-0 rounded-lg bg-gray-200" />
                            <div className="flex-1 space-y-2">
                                <div className="h-3 w-16 rounded bg-gray-200" />
                                <div className="h-4 w-full max-w-[200px] rounded bg-gray-100" />
                            </div>
                        </div>
                    ))}
                </section>
                <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
                    <div className="flex gap-4 border-b border-gray-100 pb-5">
                        <div className="h-16 w-16 shrink-0 rounded-xl bg-gray-200" />
                        <div className="flex-1 space-y-2">
                            <div className="h-4 w-28 rounded bg-gray-200" />
                            <div className="h-5 w-40 rounded bg-gray-100" />
                            <div className="h-3 w-20 rounded bg-gray-100" />
                        </div>
                    </div>
                    <div className="mt-5 space-y-3">
                        {[1, 2, 3].map((i) => (
                            <div key={i} className="flex gap-3 rounded-xl border border-gray-100 bg-gray-50/60 px-4 py-3">
                                <div className="h-9 w-9 shrink-0 rounded-lg bg-gray-200" />
                                <div className="flex-1 space-y-2">
                                    <div className="h-3 w-20 rounded bg-gray-200" />
                                    <div className="h-4 w-full rounded bg-gray-100" />
                                </div>
                            </div>
                        ))}
                    </div>
                </section>
            </div>
        </div>
    );
}



function getInitials(user) {

    const l = user?.last_name?.[0] || '';

    const f = user?.first_name?.[0] || '';

    return (l + f).toUpperCase() || '?';

}



function getRoleMeta(user) {

    if (user?.is_admin) {

        return { label: 'Администратор', badge: 'bg-purple-100 text-purple-800', ring: 'ring-purple-200' };

    }

    if (user?.is_seller) {

        return { label: 'Продавец', badge: 'bg-rose-100 text-rose-800', ring: 'ring-rose-200' };

    }

    if (user?.is_employee) {

        return { label: 'Сотрудник', badge: 'bg-emerald-100 text-emerald-800', ring: 'ring-emerald-200' };

    }

    return { label: 'Покупатель', badge: 'bg-blue-100 text-blue-800', ring: 'ring-blue-200' };

}



function InfoRow({ icon, label, value, mono }) {

    return (

        <div className="flex items-start gap-3 rounded-xl border border-gray-100 bg-gray-50/60 px-4 py-3">

            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-indigo-600 shadow-sm ring-1 ring-gray-100">

                {icon}

            </div>

            <div className="min-w-0 flex-1">

                <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</p>

                <p className={`mt-0.5 text-sm font-medium text-gray-900 break-words ${mono ? 'font-mono' : ''}`}>

                    {value || '—'}

                </p>

            </div>

        </div>

    );

}



function HeroIconButton({ onClick, title, children, variant = 'default' }) {
    const variants = {
        default: 'border border-gray-200 bg-white text-gray-600 hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-600',
        danger: 'border border-red-200 bg-red-50 text-red-600 hover:bg-red-100',
    };
    return (
        <button
            type="button"
            onClick={onClick}
            title={title}
            aria-label={title}
            className={`flex h-10 w-10 items-center justify-center rounded-xl shadow-sm transition-colors ${variants[variant]}`}
        >
            {children}
        </button>
    );
}



const inputClass =

    'w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 shadow-sm transition-colors focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20';



export default function ProfilePage() {

    const dispatch = useDispatch();
    const navigate = useNavigate();
    const { user, isLoading, isReady } = useAuthReady();
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



    const roleMeta = useMemo(() => (user ? getRoleMeta(user) : null), [user]);



    const fullName = useMemo(() => {

        const parts = [user?.last_name, user?.first_name, user?.patronymic].filter(Boolean);

        return parts.join(' ').trim();

    }, [user?.last_name, user?.first_name, user?.patronymic]);



    const displayName = useMemo(() => {

        if (!user) return '';

        const parts = [user.last_name, user.first_name, user.patronymic].filter(Boolean);

        return parts.join(' ').trim() || user.email || 'Пользователь';

    }, [user]);



    if (isLoading) {
        return <ProfilePageSkeleton />;
    }

    if (isReady && !user) {
        return (

            <div className="mt-4 sm:mt-5 px-4 sm:px-0">

                <div className="rounded-2xl border border-gray-200 bg-white p-10 text-center shadow-sm">

                    <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-indigo-50 text-indigo-600">

                        <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>

                            <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />

                        </svg>

                    </div>

                    <h2 className="text-xl font-bold text-gray-800">Войдите в аккаунт</h2>

                    <p className="mt-2 text-sm text-gray-500">Чтобы просматривать и редактировать профиль</p>

                    <Link

                        to="/auth"

                        className="mt-6 inline-flex items-center rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-700"

                    >

                        Войти

                    </Link>

                </div>

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

                    })

                )

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



    const showOrganization = Boolean(user.organization_id && (user.is_seller || user.is_director || user.is_employee));



    return (

        <div className="mt-4 sm:mt-5 space-y-6 px-4 sm:px-0">
            {/* Hero */}
            <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6">
                <div className="flex items-center gap-4">
                    <div className="flex shrink-0 flex-col items-center sm:items-start">
                        <button
                            type="button"
                            onClick={() => avatarInputRef.current?.click()}
                            disabled={avatarLoading}
                            className={`group relative block rounded-2xl shadow-md ring-4 ring-white ${roleMeta.ring} focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-60`}
                            title="Изменить фото"
                            aria-label="Изменить фото профиля"
                        >
                            <UserAvatar
                                avatarUrl={user.avatar_url}
                                firstName={user.first_name}
                                lastName={user.last_name}
                                size="xl"
                            />
                            <span className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-2xl bg-black/0 transition-colors group-hover:bg-black/40">
                                <svg
                                    className="h-7 w-7 text-white opacity-0 transition-opacity group-hover:opacity-100"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                    strokeWidth={1.5}
                                    aria-hidden
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
                                    />
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                                </svg>
                            </span>
                            {avatarLoading && (
                                <span className="absolute inset-0 flex items-center justify-center rounded-2xl bg-black/50 text-xs font-medium text-white">
                                    Загрузка…
                                </span>
                            )}
                        </button>
                        <input
                            ref={avatarInputRef}
                            type="file"
                            accept="image/jpeg,image/png,image/webp,image/gif"
                            className="hidden"
                            onChange={handleAvatarFileChange}
                        />
                        {user.avatar_url && (
                            <button
                                type="button"
                                onClick={handleDeleteAvatar}
                                disabled={avatarLoading}
                                className="mt-2 text-xs text-gray-500 transition-colors hover:text-red-600 disabled:opacity-50"
                            >
                                Удалить фото
                            </button>
                        )}
                    </div>

                    <div className="min-w-0 flex-1">
                        <h2 className="truncate text-xl font-bold text-gray-900 sm:text-2xl">{displayName}</h2>
                        <p className="truncate text-sm text-gray-500">{user.email}</p>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                            <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${roleMeta.badge}`}>
                                {roleMeta.label}
                            </span>
                            {user.public_code && (
                                <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 font-mono text-xs text-gray-600">
                                    ID {user.public_code}
                                </span>
                            )}
                        </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-2 self-center">
                        {!isEditing && (
                            <HeroIconButton onClick={handleEdit} title="Редактировать профиль">
                                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                            </HeroIconButton>
                        )}
                        <HeroIconButton onClick={() => setShowPasswordModal(true)} title="Сменить пароль">
                            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
                                />
                            </svg>
                        </HeroIconButton>
                        <HeroIconButton onClick={() => setShowLogoutModal(true)} title="Выйти" variant="danger">
                            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                            </svg>
                        </HeroIconButton>
                    </div>
                </div>
            </div>

            <div className={`grid grid-cols-1 gap-6 ${showOrganization ? 'lg:grid-cols-2 lg:items-start' : ''}`}>
            <section
                className={`h-full space-y-3 rounded-2xl border bg-white p-5 shadow-sm sm:p-6 ${
                    isEditing ? 'border-indigo-200 ring-1 ring-indigo-100' : 'border-gray-200'
                }`}
            >
                {saveError && (
                    <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{saveError}</div>
                )}

                {isEditing ? (
                    <div className="space-y-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <h3 className="text-base font-semibold text-gray-900">Личные данные</h3>
                            <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-medium text-indigo-700">
                                Редактирование
                            </span>
                        </div>

                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">

                            <div>

                                <label className="mb-1.5 block text-xs font-medium text-gray-600">Фамилия</label>

                                <input

                                    name="last_name"

                                    value={formData.last_name}

                                    onChange={handleChange}

                                    className={inputClass}

                                    autoComplete="family-name"

                                />

                            </div>

                            <div>

                                <label className="mb-1.5 block text-xs font-medium text-gray-600">Имя</label>

                                <input

                                    name="first_name"

                                    value={formData.first_name}

                                    onChange={handleChange}

                                    className={inputClass}

                                    autoComplete="given-name"

                                />

                            </div>

                            <div>

                                <label className="mb-1.5 block text-xs font-medium text-gray-600">Отчество</label>

                                <input

                                    name="patronymic"

                                    value={formData.patronymic}

                                    onChange={handleChange}

                                    className={inputClass}

                                />

                            </div>

                        </div>

                        <div className="flex flex-col-reverse gap-2 border-t border-gray-100 pt-4 sm:flex-row sm:justify-end">
                            <button
                                type="button"
                                onClick={handleCancel}
                                disabled={saving}
                                className="inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                            >
                                Отмена
                            </button>
                            <button
                                type="button"
                                onClick={handleSave}
                                disabled={saving}
                                className="inline-flex items-center justify-center rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                            >
                                {saving ? 'Сохранение…' : 'Сохранить'}
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-3">
                        <h3 className="text-base font-semibold text-gray-900">Личные данные</h3>

                        <InfoRow

                            label="ФИО"

                            value={fullName || '—'}

                            icon={

                                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>

                                    <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />

                                </svg>

                            }

                        />

                        <InfoRow

                            label="Email"

                            value={user.email}

                            icon={

                                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>

                                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />

                                </svg>

                            }

                        />

                        <InfoRow

                            label="Телефон"

                            value={user.phone}

                            icon={

                                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>

                                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />

                                </svg>

                            }

                        />

                    </div>

                )}

            </section>

            {showOrganization && (
                <OrganizationCard orgId={user.organization_id} className="h-full" />
            )}
            </div>

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



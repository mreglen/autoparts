import { useSelector } from 'react-redux';

/**
 * Профиль ещё загружается, если есть токен и идёт fetchProfile.
 * До isReady нельзя делать редиректы по правам — user может быть ещё null.
 */
export function useAuthReady() {
    const { user, token, profileLoading } = useSelector((state) => state.auth);
    const hasToken = Boolean(token);
    const isReady = !hasToken || !profileLoading;

    return {
        isReady,
        user,
        token,
        isAuthenticated: Boolean(user),
        isLoading: hasToken && profileLoading,
    };
}

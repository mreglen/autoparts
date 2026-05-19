// src/components/ProtectedRoute.jsx
import { Navigate } from 'react-router-dom';
import { useAuthReady } from '../../hooks/useAuthReady';
import AuthLoadingScreen from '../AuthLoadingScreen/AuthLoadingScreen';

export default function ProtectedRoute({ children }) {
    const { isReady, token, isAuthenticated } = useAuthReady();

    if (!isReady) {
        return <AuthLoadingScreen />;
    }

    if (!token || !isAuthenticated) {
        return <Navigate to="/auth" replace />;
    }

    return children;
}
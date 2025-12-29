// src/components/ProtectedRoute.jsx
import { useSelector } from 'react-redux';
import { Navigate } from 'react-router-dom';

export default function ProtectedRoute({ children }) {
    const { token } = useSelector((state) => state.auth);

    if (!token) {
        return <Navigate to="/auth" replace />;
    }

    return children;
}
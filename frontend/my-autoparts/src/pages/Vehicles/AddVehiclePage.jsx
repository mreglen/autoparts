import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { Navigate, useNavigate } from 'react-router-dom';
import DismantlingVehicleAddForm from './DismantlingVehicleAddForm';

function AddVehiclePage() {
  const navigate = useNavigate();
  const { user, permissionCodes } = useSelector((state) => state.auth);
  const [authChecked, setAuthChecked] = useState(false);

  const hasPermission =
    user?.is_admin ||
    user?.is_seller ||
    (user?.is_employee &&
      permissionCodes &&
      (permissionCodes.includes('vehicles') ||
        permissionCodes.includes('my-parts') ||
        permissionCodes.includes('stock-in')));

  useEffect(() => {
    if (user === undefined || user === null) {
      const token = localStorage.getItem('token');
      if (token) return;
    }
    setAuthChecked(true);
    if (!hasPermission) navigate('/', { replace: true });
  }, [user, permissionCodes, hasPermission, navigate]);

  if (!authChecked) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
        </div>
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" replace />;
  if (!hasPermission) return <Navigate to="/" replace />;

  return <DismantlingVehicleAddForm />;
}

export default AddVehiclePage;

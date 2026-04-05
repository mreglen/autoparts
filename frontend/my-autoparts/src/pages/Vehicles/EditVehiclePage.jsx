import React, { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { fetchVehicles } from '../../redux/slices/ProductSlice';
import VehicleModal from '../MyParts/AddPart/VehicleModal';

function EditVehiclePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { user, permissionCodes } = useSelector((state) => state.auth);
  const { vehicles, vehiclesLoading } = useSelector((state) => state.products);
  const [authChecked, setAuthChecked] = useState(false);

  const vehicleId = id != null ? parseInt(id, 10) : NaN;

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

  useEffect(() => {
    if (authChecked && hasPermission) {
      dispatch(fetchVehicles());
    }
  }, [dispatch, authChecked, hasPermission]);

  const vehicle = useMemo(
    () => (Array.isArray(vehicles) ? vehicles.find((v) => v.id === vehicleId) : null),
    [vehicles, vehicleId]
  );

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
  if (Number.isNaN(vehicleId)) return <Navigate to="/vehicles" replace />;

  if (vehiclesLoading && !vehicle) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
        </div>
      </div>
    );
  }

  if (!vehiclesLoading && !vehicle) {
    return <Navigate to="/vehicles" replace />;
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Редактировать автомобиль</h1>
      <VehicleModal
        isOpen
        variant="page"
        pageEditVehicle={vehicle}
        onClose={() => navigate('/vehicles')}
        onSelectVehicle={() => {}}
      />
    </div>
  );
}

export default EditVehiclePage;

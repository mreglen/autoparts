import PrinterTokenSection from './PrinterTokenSection';
import LabelPrintSection from './LabelPrintSection';
import { useSelector } from 'react-redux';
import { Navigate } from 'react-router-dom';
import { useAuthReady } from '../../hooks/useAuthReady';
import AuthLoadingScreen from '../../components/AuthLoadingScreen/AuthLoadingScreen';
import { warehousePageClass } from '../../utils/warehouseListUi';

export default function PrintSettings() {
  const { isReady, user } = useAuthReady();
  const permissionCodes = useSelector((state) => state.auth.permissionCodes);

  const hasPermission = (code) => permissionCodes && permissionCodes.includes(code);

  const canAccess =
    user?.is_admin ||
    user?.is_director ||
    user?.is_seller ||
    (user?.is_employee && hasPermission('settings.printers'));

  if (!isReady) {
    return <AuthLoadingScreen />;
  }

  if (!canAccess) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className={`${warehousePageClass} min-w-0 space-y-4`}>
      <h1 className="text-2xl font-bold text-gray-900 sm:text-[1.75rem]">Печать</h1>
      <PrinterTokenSection />
      <LabelPrintSection />
    </div>
  );
}

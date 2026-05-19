import PrinterTokenSection from './PrinterTokenSection';
import LabelPrintSection from './LabelPrintSection';
import { useSelector } from 'react-redux';
import { Navigate } from 'react-router-dom';
import { useAuthReady } from '../../hooks/useAuthReady';
import AuthLoadingScreen from '../../components/AuthLoadingScreen/AuthLoadingScreen';

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
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-800">Печать</h2>
      </div>

      {/* Printers Section */}
      <div>
        <PrinterTokenSection />
      </div>

      {/* Label Print Settings Section */}
      <div>
        <LabelPrintSection />
      </div>
    </div>
  );
}

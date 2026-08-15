import { useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import {
  fetchAllPaymentMethods,
  fetchOrgPaymentMethods,
  assignPaymentMethod,
  removePaymentMethod,
} from '../../redux/slices/OrganizationSlice';
import { Card, EmptyState, Skeleton } from '../../components/UI';
import { SettingsToggle } from './settingsUi';

const PaymentMethodsSection = ({ orgId }) => {
  const dispatch = useDispatch();
  const token = useSelector((state) => state.auth.token);
  const { allPaymentMethods, orgPaymentMethods, loadingPaymentMethods, paymentMethodsError } =
    useSelector((state) => state.organization);

  const loading =
    loadingPaymentMethods.paymentMethods || loadingPaymentMethods.paymentMethodAssignments;
  const error = paymentMethodsError;

  useEffect(() => {
    if (token && orgId) {
      dispatch(fetchAllPaymentMethods());
      dispatch(fetchOrgPaymentMethods(orgId));
    }
  }, [dispatch, token, orgId]);

  const handleCheckboxChange = async (methodId, isChecked) => {
    if (!token || !orgId) return;
    try {
      if (isChecked) {
        await dispatch(assignPaymentMethod({ orgId, methodId }));
      } else {
        await dispatch(removePaymentMethod({ orgId, methodId }));
      }
    } catch (err) {
      console.error('Error updating payment method:', err);
    }
  };

  return (
    <Card>
      <h3 className="text-sm font-semibold text-ink">Способы оплаты</h3>
      <p className="mb-4 mt-0.5 text-sm text-ink-muted">Варианты при подтверждении заказа</p>

      {loading ? (
        <div className="space-y-2">
          <Skeleton className="h-14 w-full rounded-sg" />
          <Skeleton className="h-14 w-full rounded-sg" />
        </div>
      ) : error ? (
        <EmptyState illustration="error" title="Не удалось загрузить" description={error} />
      ) : allPaymentMethods && allPaymentMethods.length > 0 ? (
        <div className="space-y-2">
          {allPaymentMethods.map((method) => {
            const isChecked = orgPaymentMethods.some((orgMethod) => orgMethod.id === method.id);
            return (
              <SettingsToggle
                key={method.id}
                checked={isChecked}
                disabled={loading}
                label={method.name}
                description={method.description}
                onChange={(e) => handleCheckboxChange(method.id, e.target.checked)}
              />
            );
          })}
        </div>
      ) : (
        <p className="py-4 text-sm text-ink-muted">Нет доступных способов оплаты</p>
      )}
    </Card>
  );
};

export default PaymentMethodsSection;

import React, { useEffect, useState } from 'react';
import Modal from '../UI/Modal';
import Button from '../UI/Button';
import { formatFinanceCurrency, getFinanceTodayDate } from '../../pages/Finance/financeDisplay';

function AutoserviceExpenseModal({
  open,
  onClose,
  onSubmit,
  employees,
  employeesLoading,
  articles = [],
  initialData = null,
  dateFrom,
  getEmployeePayrollInfo,
}) {
  const [articleId, setArticleId] = useState(initialData?.article_id || '');
  const [type] = useState(initialData?.type || 'other');
  const [amount, setAmount] = useState(initialData?.amount ? String(initialData.amount) : '');
  const [expenseDate, setExpenseDate] = useState(
    initialData?.expense_date || dateFrom || getFinanceTodayDate()
  );
  const [description, setDescription] = useState(initialData?.description || '');
  const [employeeId, setEmployeeId] = useState(initialData?.employee_id || '');
  const [payrollInfo, setPayrollInfo] = useState(null);
  const [payrollLoading, setPayrollLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setArticleId(initialData?.article_id || '');
      setAmount(initialData?.amount ? String(initialData.amount) : '');
      setExpenseDate(initialData?.expense_date || dateFrom || getFinanceTodayDate());
      setDescription(initialData?.description || '');
      setEmployeeId(initialData?.employee_id || '');
      setPayrollInfo(null);
    }
  }, [open, initialData, dateFrom]);

  useEffect(() => {
    if (type === 'salary' && employeeId && open) {
      setPayrollLoading(true);
      getEmployeePayrollInfo?.(employeeId, expenseDate).then((info) => {
        setPayrollInfo(info);
        setPayrollLoading(false);
      }).catch(() => {
        setPayrollLoading(false);
      });
    } else {
      setPayrollInfo(null);
    }
  }, [type, employeeId, expenseDate, open, getEmployeePayrollInfo]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!amount || Number(amount) <= 0) {
      return;
    }
    if (!expenseDate) {
      return;
    }
    if (type === 'salary' && !employeeId) {
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit({
        type,
        article_id: articleId ? Number(articleId) : null,
        amount: Number(amount),
        expense_date: expenseDate,
        description: description || null,
        employee_id: type === 'salary' ? Number(employeeId) : null,
      });
    } finally {
      setSubmitting(false);
    }
  };

  const isEditing = Boolean(initialData);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEditing ? 'Редактировать расход' : 'Добавить расход'}
      size="sm"
      footer={
        <div className="flex flex-wrap justify-end gap-2 max-md:flex-col">
          <Button
            variant="secondary"
            onClick={onClose}
            disabled={submitting}
            className="max-md:min-h-11"
          >
            Отмена
          </Button>
          <Button
            variant="primary"
            onClick={handleSubmit}
            disabled={submitting || !amount || Number(amount) <= 0 || !expenseDate || (type === 'salary' && !employeeId)}
            className="max-md:min-h-11"
          >
            {submitting ? 'Сохранение…' : isEditing ? 'Сохранить' : 'Создать'}
          </Button>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1.5 block text-xs font-medium text-ink-muted">Статья расхода</label>
          <select
            value={articleId}
            onChange={(e) => setArticleId(e.target.value)}
            className="w-full rounded-lg border border-line px-3 py-2 text-sm text-ink placeholder:text-ink-muted focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:cursor-wait disabled:opacity-60"
            disabled={submitting}
          >
            <option value="">Не указана</option>
            {articles.map((article) => (
              <option key={article.id} value={article.id}>{article.name}</option>
            ))}
            {initialData?.article_name && !articles.some((a) => a.id === initialData.article_id) ? (
              <option value={initialData.article_id || ''}>{initialData.article_name}</option>
            ) : null}
          </select>
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-medium text-ink-muted">Сумма, ₽</label>
          <input
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            className="w-full rounded-lg border border-line px-3 py-2 text-sm text-ink placeholder:text-ink-muted focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:cursor-wait disabled:opacity-60"
            disabled={submitting}
          />
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-medium text-ink-muted">Дата</label>
          <input
            type="date"
            value={expenseDate}
            onChange={(e) => setExpenseDate(e.target.value)}
            className="w-full rounded-lg border border-line px-3 py-2 text-sm text-ink placeholder:text-ink-muted focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:cursor-wait disabled:opacity-60"
            disabled={submitting}
          />
        </div>

        {type === 'salary' && (
          <>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-ink-muted">Сотрудник</label>
              {employeesLoading ? (
                <div className="text-sm text-ink-muted">Загрузка сотрудников…</div>
              ) : (
                <select
                  value={employeeId}
                  onChange={(e) => setEmployeeId(e.target.value)}
                  className="w-full rounded-lg border border-line px-3 py-2 text-sm text-ink placeholder:text-ink-muted focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:cursor-wait disabled:opacity-60"
                  disabled={submitting}
                >
                  <option value="">Выберите сотрудника</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>{emp.name}</option>
                  ))}
                </select>
              )}
            </div>

            {payrollLoading && (
              <div className="rounded-lg bg-surface-subtle p-3 text-sm text-ink-muted">Загрузка зарплаты…</div>
            )}

            {payrollInfo && (
              <div className="rounded-lg bg-surface-subtle p-3 text-sm">
                <div className="mb-1 font-medium text-ink">Информация о зарплате</div>
                <div className="space-y-1">
                  <div className="flex justify-between">
                    <span className="text-ink-muted">Начислено:</span>
                    <span className="font-medium">{formatFinanceCurrency(payrollInfo.total_accrued)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-ink-muted">Выдано:</span>
                    <span className="font-medium">{formatFinanceCurrency(payrollInfo.total_paid)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-ink-muted">Осталось:</span>
                    <span className={`font-medium ${payrollInfo.remaining >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {formatFinanceCurrency(payrollInfo.remaining)}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        <div>
          <label className="mb-1.5 block text-xs font-medium text-ink-muted">Описание</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Необязательно"
            rows={2}
            className="w-full rounded-lg border border-line px-3 py-2 text-sm text-ink placeholder:text-ink-muted focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:cursor-wait disabled:opacity-60 resize-none"
            disabled={submitting}
          />
        </div>
      </form>
    </Modal>
  );
}

export default AutoserviceExpenseModal;

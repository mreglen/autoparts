import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiRequest } from '../../utils/apiClient';
import { formatFinanceCurrency, getFinanceTodayDate } from '../Finance/financeDisplay';
import AuthLoadingScreen from '../../components/AuthLoadingScreen/AuthLoadingScreen';
import NumericInput from '../../components/UI/NumericInput';
import Toast from '../../components/UI/Toast';
import { useAuthReady } from '../../hooks/useAuthReady';
import useHistoryBack from '../../hooks/useHistoryBack';
import { Z_MOBILE_STICKY_FOOTER } from '../../constants/mobileTokens';

const pillInputClass = 'sg-pill-input mt-1';
const pillTextareaClass = 'sg-pill-textarea mt-1';
const pillDateInputClass = 'sg-pill-input sg-native-date-input mt-1';

const linkActionClass = 'text-sm font-medium text-brand-600 hover:text-brand-700';

const DEFAULT_EXPENSE_ARTICLES = ['Зарплата', 'Прочее'];
const SALARY_ARTICLE_NAME = 'зарплата';

const btnPrimaryClass =
  'inline-flex min-h-11 items-center justify-center rounded-sg-sm bg-brand-600 px-4 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60 sm:min-h-10';

const btnSecondaryClass =
  'inline-flex min-h-11 items-center justify-center rounded-sg-sm border border-line-strong bg-surface px-4 text-sm font-medium text-ink-soft transition hover:bg-surface-muted disabled:opacity-60 sm:min-h-10';

const expenseFormPageClass =
  'w-full min-w-0 pt-0 pb-28 max-lg:pb-[calc(var(--sg-mobile-sticky-bottom-offset)+8.5rem)] lg:pb-24';

function FieldLabel({ children, optional = false }) {
  return (
    <span className="block min-w-0 text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
      {children}
      {optional ? <span className="font-normal text-ink-faint"> (необязательно)</span> : null}
    </span>
  );
}

function formatAmountInput(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '';
  return n.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function AutoserviceExpenseFormPage() {
  const { isReady, isAuthenticated, user } = useAuthReady();
  const navigate = useNavigate();
  const goBack = useHistoryBack('/autoservice/finance');

  const [articles, setArticles] = useState([]);
  const [articleId, setArticleId] = useState(null);
  const [articleQuery, setArticleQuery] = useState('');
  const [articleOpen, setArticleOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [expenseDate, setExpenseDate] = useState(() => getFinanceTodayDate());
  const [description, setDescription] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [employees, setEmployees] = useState([]);
  const [employeesLoading, setEmployeesLoading] = useState(false);
  const [payrollInfo, setPayrollInfo] = useState(null);
  const [payrollLoading, setPayrollLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isReady || !isAuthenticated) return undefined;
    let cancelled = false;
    apiRequest('/autoservice/expense-articles')
      .then((rows) => {
        if (!cancelled) setArticles(Array.isArray(rows) ? rows : []);
      })
      .catch(() => {
        if (!cancelled) setArticles([]);
      });
    setEmployeesLoading(true);
    apiRequest('/autoservice/service-employees')
      .then((rows) => {
        if (!cancelled) setEmployees(Array.isArray(rows) ? rows : []);
      })
      .catch(() => {
        if (!cancelled) setEmployees([]);
      })
      .finally(() => {
        if (!cancelled) setEmployeesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isReady, isAuthenticated]);

  const amountNumber = Number(String(amount || '').replace(',', '.'));
  const amountValid = Number.isFinite(amountNumber) && amountNumber > 0;
  const articleName = articleId
    ? (articles.find((a) => a.id === articleId)?.name || articleQuery.trim())
    : articleQuery.trim();
  const isSalaryArticle = articleName.trim().toLowerCase() === SALARY_ARTICLE_NAME;
  const canSubmit =
    amountValid &&
    Boolean(expenseDate) &&
    Boolean(articleName) &&
    (!isSalaryArticle || Boolean(employeeId));

  const mergedArticles = useMemo(() => {
    const byName = new Map(
      articles.map((a) => [a.name.trim().toLowerCase(), a]),
    );
    const defaults = DEFAULT_EXPENSE_ARTICLES.map(
      (name) => byName.get(name.toLowerCase()) || { id: null, name },
    );
    const rest = articles.filter(
      (a) => !DEFAULT_EXPENSE_ARTICLES.includes(a.name.trim().toLowerCase()),
    );
    return [...defaults, ...rest];
  }, [articles]);

  const normalizedArticleQuery = articleQuery.trim().toLowerCase();
  const filteredArticles = mergedArticles.filter((a) =>
    a.name.toLowerCase().includes(normalizedArticleQuery),
  );
  const exactArticleMatch = mergedArticles.some(
    (a) => a.name.toLowerCase() === normalizedArticleQuery,
  );

  useEffect(() => {
    if (!employeeId || !expenseDate || !isSalaryArticle) {
      setPayrollInfo(null);
      return undefined;
    }
    let cancelled = false;
    setPayrollLoading(true);
    const base = new Date(`${expenseDate}T00:00:00`);
    const params = new URLSearchParams({
      year: base.getFullYear(),
      month: base.getMonth() + 1,
    });
    apiRequest(`/autoservice/finance/expenses/employee-payroll/${employeeId}?${params.toString()}`)
      .then((info) => {
        if (!cancelled) setPayrollInfo(info);
      })
      .catch(() => {
        if (!cancelled) setPayrollInfo(null);
      })
      .finally(() => {
        if (!cancelled) setPayrollLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [employeeId, expenseDate, isSalaryArticle]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!amountValid) {
      setError('Укажите сумму больше 0');
      return;
    }
    if (!expenseDate) {
      setError('Укажите дату расхода');
      return;
    }
    if (!articleName) {
      setError('Укажите статью расхода');
      return;
    }
    setSaving(true);
    try {
      await apiRequest('/autoservice/finance/expenses', {
        method: 'POST',
        body: JSON.stringify({
          article_id: articleId || null,
          article_name: articleId ? null : articleName,
          amount: amountNumber,
          expense_date: expenseDate,
          description: description.trim() || null,
          type: isSalaryArticle ? 'salary' : 'other',
          employee_id: isSalaryArticle && employeeId ? Number(employeeId) : null,
        }),
      });
      navigate('/autoservice/finance', { state: { tab: 'expenses', expenseCreated: true } });
    } catch (err) {
      setError(err?.message || 'Не удалось создать расход');
      setSaving(false);
    }
  };

  if (!isReady) return <AuthLoadingScreen />;
  if (!isAuthenticated || !user) return null;

  return (
    <div className={expenseFormPageClass}>
      <header className="mb-3 max-lg:hidden">
        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
          <button type="button" onClick={goBack} className={linkActionClass}>
            ← Закрыть
          </button>
          <h1 className="min-w-0 flex-1 break-words text-lg font-semibold leading-snug text-ink lg:text-xl">
            Новый расход
          </h1>
        </div>
      </header>

      <Toast message={error} variant="error" onClose={() => setError('')} />

      <form id="expense-form" onSubmit={handleSubmit} className="min-w-0">
        <section className="min-w-0 space-y-5">
          <div className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="relative min-w-0">
              <FieldLabel>Статья расхода</FieldLabel>
              <input
                type="text"
                className={pillInputClass}
                value={articleQuery}
                onChange={(e) => {
                  setArticleQuery(e.target.value);
                  setArticleId(null);
                  setArticleOpen(true);
                }}
                onFocus={() => setArticleOpen(true)}
                onBlur={() => setTimeout(() => setArticleOpen(false), 150)}
                placeholder="Выберите или введите новую"
                disabled={saving}
                autoComplete="off"
              />
              {articleOpen ? (
                <div className="absolute inset-x-0 top-full z-20 mt-1 max-h-56 overflow-y-auto rounded-sg-sm border border-line bg-surface py-1 shadow-sg-md">
                  {filteredArticles.map((article) => (
                    <button
                      key={article.id ?? article.name}
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        setArticleId(article.id);
                        setArticleQuery(article.name);
                        setArticleOpen(false);
                      }}
                      className="block w-full truncate px-3 py-1.5 text-left text-sm text-ink hover:bg-surface-muted"
                    >
                      {article.name}
                    </button>
                  ))}
                  {articleQuery.trim() && !exactArticleMatch ? (
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => setArticleOpen(false)}
                      className="block w-full truncate px-3 py-1.5 text-left text-sm font-medium text-brand-700 hover:bg-brand-50"
                    >
                      Создать «{articleQuery.trim()}»
                    </button>
                  ) : null}
                  {!filteredArticles.length && !articleQuery.trim() ? (
                    <p className="px-3 py-1.5 text-sm text-ink-muted">Статей пока нет — введите название</p>
                  ) : null}
                </div>
              ) : null}
            </div>
            <div className="min-w-0">
              <FieldLabel>Сумма, ₽</FieldLabel>
              <NumericInput
                mode="decimal"
                className={pillInputClass}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                disabled={saving}
              />
            </div>
            <div className="min-w-0">
              <FieldLabel>Дата</FieldLabel>
              <input
                type="date"
                className={pillDateInputClass}
                value={expenseDate}
                max={getFinanceTodayDate()}
                onChange={(e) => setExpenseDate(e.target.value)}
                disabled={saving}
              />
            </div>
            {isSalaryArticle ? (
            <div className="min-w-0">
              <FieldLabel>Сотрудник</FieldLabel>
              <select
                className={pillInputClass}
                value={employeeId}
                onChange={(e) => setEmployeeId(e.target.value)}
                disabled={saving || employeesLoading}
              >
                <option value="">
                  {employeesLoading ? 'Загрузка сотрудников…' : 'Выберите сотрудника'}
                </option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>{emp.name}</option>
                ))}
              </select>
            </div>
            ) : null}
            <div className="min-w-0 lg:col-span-2">
              <FieldLabel optional>Описание</FieldLabel>
              <textarea
                className={pillTextareaClass}
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Необязательно"
                disabled={saving}
              />
            </div>
          </div>

          {employeeId ? (
            <div className="min-w-0 rounded-sg-sm border border-line-soft bg-surface-muted px-4 py-3">
              {payrollLoading ? (
                <p className="text-sm text-ink-muted">Загрузка зарплаты…</p>
              ) : null}
              {payrollInfo ? (
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between gap-3">
                    <span className="text-ink-muted">Начислено:</span>
                    <span className="font-medium tabular-nums text-ink">
                      {formatFinanceCurrency(payrollInfo.total_accrued)}
                    </span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="text-ink-muted">Выдано:</span>
                    <span className="font-medium tabular-nums text-ink">
                      {formatFinanceCurrency(payrollInfo.total_paid)}
                    </span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="text-ink-muted">Осталось:</span>
                    <span
                      className={`font-medium tabular-nums ${
                        payrollInfo.remaining >= 0 ? 'text-success-700' : 'text-danger-600'
                      }`}
                    >
                      {formatFinanceCurrency(payrollInfo.remaining)}
                    </span>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
        </section>
      </form>

      <div
        className="pointer-events-none fixed inset-x-0 bottom-[calc(var(--sg-mobile-sticky-bottom-offset)+0.75rem)] lg:bottom-0"
        style={{ zIndex: Z_MOBILE_STICKY_FOOTER }}
      >
        <div className="pointer-events-auto min-w-0 bg-surface">
          <div className="mx-auto w-full min-w-0 max-w-sg-content px-2.5 py-3 sm:px-5 sm:py-4 lg:px-8">
            <div className="flex w-full min-w-0 flex-col gap-2 lg:flex-row lg:items-center lg:justify-between lg:gap-3">
              <div className="min-w-0 lg:flex-1">
                <p className="text-sm font-semibold text-ink">Расход</p>
                <p className="text-[11px] leading-snug text-ink-muted sm:text-xs">
                  {amountValid ? `Сумма: ${formatAmountInput(amountNumber)} ₽` : 'Укажите сумму расхода'}
                </p>
              </div>
              <div className="flex min-w-0 flex-1 flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-end">
                <button
                  type="submit"
                  form="expense-form"
                  disabled={saving || !canSubmit}
                  className={`${btnPrimaryClass} max-lg:w-full max-lg:px-3`}
                >
                  {saving ? 'Сохранение…' : 'Сохранить и закрыть'}
                </button>
                <button
                  type="button"
                  onClick={goBack}
                  disabled={saving}
                  className={`${btnSecondaryClass} max-lg:w-full max-lg:px-3`}
                >
                  Закрыть
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

import { useState, useMemo, useEffect } from 'react'
import { useToast } from '../context/ToastContext'
import { useIncome, useExpenses, useRecurring, useCategories } from '../hooks/useData'
import { useTenant } from '../context/TenantContext'
import { useAuth } from '../context/AuthContext'
import { formatCurrency } from '../lib/utils'
import {
  TrendingUp, TrendingDown, Plus, Loader2, X, Check, Repeat,
  ChevronDown, ChevronUp, RefreshCw, Calendar, Lock,
  ArrowUpCircle, ArrowDownCircle, Search, BarChart3, Building2,
} from 'lucide-react'

type MainTab = 'income' | 'expenses' | 'recurring' | 'pnl'
type AmountType = 'fixed' | 'variable'

export default function FinancePage() {
  const { currentBranch, branches } = useTenant()
  const { isAdmin, currentUser } = useAuth()
  const [filterBranch, setFilterBranch] = useState<string | null>(null)

  // Non-admin users see only their branch
  useEffect(() => {
    if (!isAdmin && currentUser?.branch_id) setFilterBranch(currentUser.branch_id)
  }, [isAdmin, currentUser?.branch_id])

  const branchForQuery = filterBranch || (isAdmin ? null : currentBranch?.id) || null
  const { entries: allIncomeEntries, loading: incomeLoading, add: addIncome, fetch: fetchIncome } = useIncome(branchForQuery)
  const { expenses: allExpenses, loading: expenseLoading, add: addExpense, fetch: fetchExpenses } = useExpenses(branchForQuery)
  const { items: recurring, loading: recurringLoading, add: addRecurring, deactivate, execute: executeRecurring } = useRecurring()
  const { categories: allCategories } = useCategories()
  const toast = useToast()

  // Filters state
  const [incomeSearch, setIncomeSearch] = useState('')
  const [incomeFromDate, setIncomeFromDate] = useState('')
  const [incomeToDate, setIncomeToDate] = useState('')
  const [expenseSearch, setExpenseSearch] = useState('')
  const [expenseFromDate, setExpenseFromDate] = useState('')
  const [expenseToDate, setExpenseToDate] = useState('')


  // Filtered income/expenses for display (totals remain from all entries)
  const filteredIncome = useMemo(() => {
    if (!incomeSearch && !incomeFromDate && !incomeToDate) return allIncomeEntries
    return allIncomeEntries.filter(e => {
      const matchSearch = !incomeSearch || [e.source, e.description].some(v => v?.toLowerCase().includes(incomeSearch.toLowerCase()))
      const matchFrom = !incomeFromDate || (e.income_date || '') >= incomeFromDate
      const matchTo = !incomeToDate || (e.income_date || '') <= incomeToDate
      return matchSearch && matchFrom && matchTo
    })
  }, [allIncomeEntries, incomeSearch, incomeFromDate, incomeToDate])

  const filteredExpenses = useMemo(() => {
    if (!expenseSearch && !expenseFromDate && !expenseToDate) return allExpenses
    return allExpenses.filter(e => {
      const matchSearch = !expenseSearch || [e.category, e.description].some(v => v?.toLowerCase().includes(expenseSearch.toLowerCase()))
      const matchFrom = !expenseFromDate || (e.expense_date || '') >= expenseFromDate
      const matchTo = !expenseToDate || (e.expense_date || '') <= expenseToDate
      return matchSearch && matchFrom && matchTo
    })
  }, [allExpenses, expenseSearch, expenseFromDate, expenseToDate])

  // Show ALL income/expenses including executed recurring ones in the tabs
  // (Recurring tab manages templates, income/expense tabs show all transactions)
  const incomeEntries = allIncomeEntries
  const expenses = allExpenses

  const incomeCategories = useMemo(() => allCategories.filter(c => c.applies_to === 'income' || c.applies_to === 'all'), [allCategories])
  const expenseCategories = useMemo(() => allCategories.filter(c => c.applies_to === 'expense' || c.applies_to === 'all'), [allCategories])

  // P&L: group income/expenses by category — must be before any early return
  const incomeBySource = useMemo(() => {
    const map: Record<string, number> = {}
    allIncomeEntries.forEach(e => { map[e.source || 'غير مصنف'] = (map[e.source || 'غير مصنف'] || 0) + Number(e.amount) })
    return Object.entries(map).sort((a, b) => b[1] - a[1])
  }, [allIncomeEntries])

  const expensesByCategory = useMemo(() => {
    const map: Record<string, number> = {}
    allExpenses.forEach(e => { map[e.category || 'غير مصنف'] = (map[e.category || 'غير مصنف'] || 0) + Number(e.amount) })
    return Object.entries(map).sort((a, b) => b[1] - a[1])
  }, [allExpenses])

  const [tab, setTab] = useState<MainTab>('income')
  const [showForm, setShowForm] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [expandedRecurring, setExpandedRecurring] = useState<string | null>(null)
  const [variableModal, setVariableModal] = useState<{ item: any; amount: string } | null>(null)

  const today = new Date().toISOString().split('T')[0]
  const emptyIncomeForm = { source: '', amount: '', description: '', income_date: today }
  const emptyExpenseForm = { category: '', amount: '', description: '', expense_date: today }
  const emptyRecurringForm = {
    name: '', type: 'expense' as 'expense' | 'income', category: '',
    amount: '', amount_type: 'fixed' as AmountType,
    recurrence_type: 'monthly' as 'monthly' | 'weekly' | 'yearly',
    recurrence_day: 1, start_date: today,
  }

  const [incomeForm, setIncomeForm] = useState(emptyIncomeForm)
  const [expenseForm, setExpenseForm] = useState(emptyExpenseForm)
  const [recurringForm, setRecurringForm] = useState(emptyRecurringForm)

  const totalIncome = incomeEntries.reduce((s, e) => s + Number(e.amount), 0)
  const totalExpenses = expenses.reduce((s, e) => s + Number(e.amount), 0)
  const netBalance = totalIncome - totalExpenses

  const handleAddIncome = async () => {
    const amount = parseFloat(incomeForm.amount)
    if (!amount || amount <= 0 || !incomeForm.source) return toast.warning('أدخل المصدر والمبلغ')
    setProcessing(true)
    await addIncome({ source: incomeForm.source, amount, description: incomeForm.description || null, income_date: incomeForm.income_date, branch_id: currentBranch?.id || null, is_recurring: false })
    setProcessing(false); setShowForm(false); setIncomeForm(emptyIncomeForm)
    toast.success('تمت إضافة الإيراد')
  }

  const handleAddExpense = async () => {
    const amount = parseFloat(expenseForm.amount)
    if (!amount || amount <= 0 || !expenseForm.category) return toast.warning('أدخل التصنيف والمبلغ')
    setProcessing(true)
    await addExpense({ category: expenseForm.category, amount, description: expenseForm.description || null, expense_date: expenseForm.expense_date, status: 'paid', branch_id: currentBranch?.id || null, is_recurring: false, created_by: null })
    setProcessing(false); setShowForm(false); setExpenseForm(emptyExpenseForm)
    toast.success('تمت إضافة المصروف')
  }

  const handleAddRecurring = async () => {
    const amount = parseFloat(recurringForm.amount)
    if (recurringForm.amount_type === 'fixed' && (!amount || amount <= 0)) return toast.warning('أدخل المبلغ الثابت')
    if (!recurringForm.name || !recurringForm.category) return toast.warning('أدخل الاسم والتصنيف')
    setProcessing(true)
    const nextDate = new Date(recurringForm.start_date)
    await addRecurring({
      name: recurringForm.name, type: recurringForm.type, category: recurringForm.category,
      amount: recurringForm.amount_type === 'fixed' ? amount : 0,
      amount_type: recurringForm.amount_type,
      recurrence_type: recurringForm.recurrence_type, recurrence_day: recurringForm.recurrence_day,
      start_date: recurringForm.start_date, next_run_date: nextDate.toISOString().split('T')[0],
      total_runs: 0, total_amount: 0, is_active: true, auto_post: false,
    })
    setProcessing(false); setShowForm(false); setRecurringForm(emptyRecurringForm)
    toast.success('تمت إضافة المعاملة المتكررة')
  }

  const handleExecuteRecurring = async (item: any) => {
    if (item.amount_type === 'variable') {
      setVariableModal({ item, amount: '' })
    } else {
      await executeRecurring(item)
      // Refresh income/expenses to show the new transaction
      if (item.type === 'income') await fetchIncome()
      else await fetchExpenses()
      toast.success(`تم تسجيل "${item.name}"`)
    }
  }

  const handleConfirmVariable = async () => {
    if (!variableModal) return
    const amount = parseFloat(variableModal.amount)
    if (!amount || amount <= 0) return toast.warning('أدخل مبلغاً صحيحاً')
    setProcessing(true)
    const itemWithAmount = { ...variableModal.item, amount }
    await executeRecurring(itemWithAmount)
    // Refresh income/expenses to show the new transaction
    if (itemWithAmount.type === 'income') await fetchIncome()
    else await fetchExpenses()
    setProcessing(false); setVariableModal(null)
    toast.success(`تم تسجيل "${itemWithAmount.name}" بمبلغ ${formatCurrency(amount)}`)
  }

  const loading = incomeLoading || expenseLoading || recurringLoading
  if (loading && incomeEntries.length === 0 && expenses.length === 0 && recurring.length === 0) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin" style={{ color: 'var(--primary)' }} /></div>
  }



  const tabs: { id: MainTab; label: string; icon: typeof TrendingUp }[] = [
    { id: 'income', label: 'الإيرادات', icon: TrendingUp },
    { id: 'expenses', label: 'المصروفات', icon: TrendingDown },
    { id: 'recurring', label: 'المتكررة', icon: Repeat },
    { id: 'pnl', label: 'الأرباح', icon: BarChart3 },
  ]

  return (
    <div className="space-y-4 max-w-5xl slide-up">
      {/* Branch Filter — admin only */}
      {isAdmin && branches.length > 1 && (
        <div className="flex items-center gap-2">
          <Building2 className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
          <div className="flex items-center gap-1 p-1 rounded-xl" style={{ background: 'var(--bg-input)' }}>
            <button onClick={() => setFilterBranch(null)} className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
              style={{ background: !filterBranch ? 'var(--bg-card)' : 'transparent', color: !filterBranch ? 'var(--primary)' : 'var(--text-muted)', boxShadow: !filterBranch ? '0 1px 3px rgba(0,0,0,0.1)' : 'none' }}>
              كل الفروع
            </button>
            {branches.map(b => (
              <button key={b.id} onClick={() => setFilterBranch(b.id)} className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
                style={{ background: filterBranch === b.id ? 'var(--bg-card)' : 'transparent', color: filterBranch === b.id ? 'var(--primary)' : 'var(--text-muted)', boxShadow: filterBranch === b.id ? '0 1px 3px rgba(0,0,0,0.1)' : 'none' }}>
                {b.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* KPI */}
      <div className="grid grid-cols-3 gap-3">
        <div className="p-4 rounded-2xl border transition-all duration-200 hover:shadow-md" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-light)' }}>
          <div className="flex items-center gap-2 mb-1"><ArrowUpCircle className="w-4 h-4" style={{ color: '#10b981' }} /><p className="text-xs font-bold" style={{ color: 'var(--text-muted)' }}>إجمالي الإيرادات</p></div>
          <p className="text-xl font-black tabular-nums" style={{ color: '#10b981' }}>{formatCurrency(totalIncome)}</p>
        </div>
        <div className="p-4 rounded-2xl border transition-all duration-200 hover:shadow-md" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-light)' }}>
          <div className="flex items-center gap-2 mb-1"><ArrowDownCircle className="w-4 h-4" style={{ color: '#ef4444' }} /><p className="text-xs font-bold" style={{ color: 'var(--text-muted)' }}>إجمالي المصروفات</p></div>
          <p className="text-xl font-black tabular-nums" style={{ color: '#ef4444' }}>{formatCurrency(totalExpenses)}</p>
        </div>
        <div className="p-4 rounded-2xl border transition-all duration-200 hover:shadow-md" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-light)' }}>
          <p className="text-xs font-bold mb-1" style={{ color: 'var(--text-muted)' }}>صافي الرصيد</p>
          <p className="text-xl font-black tabular-nums" style={{ color: netBalance >= 0 ? '#10b981' : '#ef4444' }}>{formatCurrency(netBalance)}</p>
        </div>
      </div>

      {/* Tabs + Add */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-1 p-1 rounded-xl" style={{ background: 'var(--bg-input)' }}>
          {tabs.map(t => {
            const Icon = t.icon
            return (
              <button key={t.id} onClick={() => { setTab(t.id); setShowForm(false) }}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all"
                style={{ background: tab === t.id ? 'var(--bg-card)' : 'transparent', color: tab === t.id ? 'var(--primary)' : 'var(--text-muted)', boxShadow: tab === t.id ? '0 1px 3px rgba(0,0,0,0.15)' : 'none' }}>
                <Icon className="w-3.5 h-3.5" />{t.label}
              </button>
            )
          })}
        </div>
        {tab !== 'pnl' && (
          <button onClick={() => setShowForm(true)} className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]" style={{ background: 'var(--primary)', color: 'var(--text-on-primary)', boxShadow: '0 4px 14px rgba(16, 185, 129, 0.25)' }}>
            <Plus className="w-4 h-4" />إضافة
          </button>
        )}
      </div>

      {/* ── Add Form Modal ── */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center fade-in" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}>
          <div className="p-5 rounded-2xl shadow-2xl max-w-md w-full mx-4 space-y-3 slide-up" style={{ background: 'var(--bg-card)' }}>
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold" style={{ color: 'var(--text-heading)' }}>
                {tab === 'income' ? 'إضافة إيراد' : tab === 'expenses' ? 'إضافة مصروف' : 'إضافة متكررة'}
              </h3>
              <button onClick={() => setShowForm(false)} style={{ color: 'var(--text-muted)' }}><X className="w-5 h-5" /></button>
            </div>

            {tab === 'income' && <>
              <div>
                <label className="block text-xs font-bold mb-1" style={{ color: 'var(--text-muted)' }}>المصدر / التصنيف</label>
                <select value={incomeForm.source} onChange={e => setIncomeForm({ ...incomeForm, source: e.target.value })} className="w-full px-3 py-2.5 rounded-xl border text-sm" style={{ background: 'var(--bg-input)', borderColor: 'var(--border)', color: 'var(--text-main)' }}>
                  <option value="">— اختر —</option>
                  {incomeCategories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                  <option value="يدوي">يدوي (غير مصنف)</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs font-bold mb-1" style={{ color: 'var(--text-muted)' }}>المبلغ</label><input type="number" min="0" step="0.01" value={incomeForm.amount} onChange={e => setIncomeForm({ ...incomeForm, amount: e.target.value })} className="w-full px-3 py-2.5 rounded-xl border text-sm" dir="ltr" style={{ background: 'var(--bg-input)', borderColor: 'var(--border)', color: 'var(--text-main)' }} /></div>
                <div><label className="block text-xs font-bold mb-1" style={{ color: 'var(--text-muted)' }}>التاريخ</label><input type="date" value={incomeForm.income_date} onChange={e => setIncomeForm({ ...incomeForm, income_date: e.target.value })} className="w-full px-3 py-2.5 rounded-xl border text-sm" style={{ background: 'var(--bg-input)', borderColor: 'var(--border)', color: 'var(--text-main)' }} /></div>
              </div>
              <div><label className="block text-xs font-bold mb-1" style={{ color: 'var(--text-muted)' }}>ملاحظات</label><input value={incomeForm.description} onChange={e => setIncomeForm({ ...incomeForm, description: e.target.value })} className="w-full px-3 py-2.5 rounded-xl border text-sm" style={{ background: 'var(--bg-input)', borderColor: 'var(--border)', color: 'var(--text-main)' }} /></div>
              <button onClick={handleAddIncome} disabled={processing} className="w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2" style={{ background: 'var(--primary)', color: 'var(--text-on-primary)' }}>
                {processing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}حفظ
              </button>
            </>}

            {tab === 'expenses' && <>
              <div>
                <label className="block text-xs font-bold mb-1" style={{ color: 'var(--text-muted)' }}>التصنيف</label>
                <select value={expenseForm.category} onChange={e => setExpenseForm({ ...expenseForm, category: e.target.value })} className="w-full px-3 py-2.5 rounded-xl border text-sm" style={{ background: 'var(--bg-input)', borderColor: 'var(--border)', color: 'var(--text-main)' }}>
                  <option value="">— اختر —</option>
                  {expenseCategories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                  <option value="عام">عام (غير مصنف)</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs font-bold mb-1" style={{ color: 'var(--text-muted)' }}>المبلغ</label><input type="number" min="0" step="0.01" value={expenseForm.amount} onChange={e => setExpenseForm({ ...expenseForm, amount: e.target.value })} className="w-full px-3 py-2.5 rounded-xl border text-sm" dir="ltr" style={{ background: 'var(--bg-input)', borderColor: 'var(--border)', color: 'var(--text-main)' }} /></div>
                <div><label className="block text-xs font-bold mb-1" style={{ color: 'var(--text-muted)' }}>التاريخ</label><input type="date" value={expenseForm.expense_date} onChange={e => setExpenseForm({ ...expenseForm, expense_date: e.target.value })} className="w-full px-3 py-2.5 rounded-xl border text-sm" style={{ background: 'var(--bg-input)', borderColor: 'var(--border)', color: 'var(--text-main)' }} /></div>
              </div>
              <div><label className="block text-xs font-bold mb-1" style={{ color: 'var(--text-muted)' }}>وصف / ملاحظات</label><input value={expenseForm.description} onChange={e => setExpenseForm({ ...expenseForm, description: e.target.value })} className="w-full px-3 py-2.5 rounded-xl border text-sm" style={{ background: 'var(--bg-input)', borderColor: 'var(--border)', color: 'var(--text-main)' }} /></div>
              <button onClick={handleAddExpense} disabled={processing} className="w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2" style={{ background: '#ef4444', color: '#fff' }}>
                {processing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}حفظ
              </button>
            </>}

            {tab === 'recurring' && <>
              <div>
                <label className="block text-xs font-bold mb-2" style={{ color: 'var(--text-muted)' }}>نوع المبلغ</label>
                <div className="grid grid-cols-2 gap-2">
                  {([{ v: 'fixed' as AmountType, label: 'ثابت', desc: 'يتكرر بنفس المبلغ' }, { v: 'variable' as AmountType, label: 'متغير', desc: 'يُطلب عند كل دورة' }]).map(opt => (
                    <button key={opt.v} onClick={() => setRecurringForm(f => ({ ...f, amount_type: opt.v }))}
                      className="p-3 rounded-xl border-2 text-right"
                      style={{ borderColor: recurringForm.amount_type === opt.v ? 'var(--primary)' : 'var(--border-light)', background: recurringForm.amount_type === opt.v ? 'rgba(16,185,129,0.05)' : 'var(--bg-input)' }}>
                      <p className="text-xs font-bold" style={{ color: recurringForm.amount_type === opt.v ? 'var(--primary)' : 'var(--text-heading)' }}>{opt.label}</p>
                      <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{opt.desc}</p>
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs font-bold mb-1" style={{ color: 'var(--text-muted)' }}>النوع</label><select value={recurringForm.type} onChange={e => setRecurringForm({ ...recurringForm, type: e.target.value as any })} className="w-full px-3 py-2.5 rounded-xl border text-sm" style={{ background: 'var(--bg-input)', borderColor: 'var(--border)', color: 'var(--text-main)' }}><option value="expense">مصروف</option><option value="income">إيراد</option></select></div>
                <div><label className="block text-xs font-bold mb-1" style={{ color: 'var(--text-muted)' }}>التكرار</label><select value={recurringForm.recurrence_type} onChange={e => setRecurringForm({ ...recurringForm, recurrence_type: e.target.value as any })} className="w-full px-3 py-2.5 rounded-xl border text-sm" style={{ background: 'var(--bg-input)', borderColor: 'var(--border)', color: 'var(--text-main)' }}><option value="monthly">شهري</option><option value="weekly">أسبوعي</option><option value="yearly">سنوي</option></select></div>
              </div>
              <div><label className="block text-xs font-bold mb-1" style={{ color: 'var(--text-muted)' }}>الاسم</label><input value={recurringForm.name} onChange={e => setRecurringForm({ ...recurringForm, name: e.target.value })} placeholder="مثال: فاتورة الكهرباء" className="w-full px-3 py-2.5 rounded-xl border text-sm" style={{ background: 'var(--bg-input)', borderColor: 'var(--border)', color: 'var(--text-main)' }} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs font-bold mb-1" style={{ color: 'var(--text-muted)' }}>التصنيف</label><select value={recurringForm.category} onChange={e => setRecurringForm({ ...recurringForm, category: e.target.value })} className="w-full px-3 py-2.5 rounded-xl border text-sm" style={{ background: 'var(--bg-input)', borderColor: 'var(--border)', color: 'var(--text-main)' }}><option value="">— اختر —</option>{(recurringForm.type === 'expense' ? expenseCategories : incomeCategories).map(c => <option key={c.id} value={c.name}>{c.name}</option>)}<option value="عام">عام</option></select></div>
                <div>
                  <label className="block text-xs font-bold mb-1" style={{ color: 'var(--text-muted)' }}>{recurringForm.amount_type === 'fixed' ? 'المبلغ الثابت' : 'المبلغ التقريبي'}</label>
                  <input type="number" min="0" step="0.01" value={recurringForm.amount} placeholder={recurringForm.amount_type === 'variable' ? 'متغير' : ''} onChange={e => setRecurringForm({ ...recurringForm, amount: e.target.value })} className="w-full px-3 py-2.5 rounded-xl border text-sm" dir="ltr" style={{ background: 'var(--bg-input)', borderColor: 'var(--border)', color: 'var(--text-main)' }} />
                </div>
              </div>
              <div><label className="block text-xs font-bold mb-1" style={{ color: 'var(--text-muted)' }}>تاريخ البدء</label><input type="date" value={recurringForm.start_date} onChange={e => setRecurringForm({ ...recurringForm, start_date: e.target.value })} className="w-full px-3 py-2.5 rounded-xl border text-sm" style={{ background: 'var(--bg-input)', borderColor: 'var(--border)', color: 'var(--text-main)' }} /></div>
              <button onClick={handleAddRecurring} disabled={processing} className="w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2" style={{ background: 'var(--primary)', color: 'var(--text-on-primary)' }}>
                {processing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Repeat className="w-4 h-4" />}حفظ
              </button>
            </>}
          </div>
        </div>
      )}

      {/* ── Variable Amount Modal ── */}
      {variableModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.6)' }}>
          <div className="p-5 rounded-2xl shadow-2xl max-w-sm w-full mx-4 space-y-4" style={{ background: 'var(--bg-card)' }}>
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold" style={{ color: 'var(--text-heading)' }}>مبلغ الدورة الحالية</h3>
              <button onClick={() => setVariableModal(null)} style={{ color: 'var(--text-muted)' }}><X className="w-5 h-5" /></button>
            </div>
            <div className="p-3 rounded-xl" style={{ background: 'var(--bg-input)' }}>
              <p className="text-sm font-bold" style={{ color: 'var(--text-heading)' }}>{variableModal.item.name}</p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                {variableModal.item.recurrence_type === 'monthly' ? 'شهري' : variableModal.item.recurrence_type === 'weekly' ? 'أسبوعي' : 'سنوي'} ·
                آخر تسجيل: {variableModal.item.last_run_date || 'لم يُسجَّل بعد'}
              </p>
            </div>
            <div>
              <label className="block text-xs font-bold mb-1" style={{ color: 'var(--text-muted)' }}>مبلغ هذه الدورة</label>
              <input type="number" min="0.01" step="0.01" autoFocus
                value={variableModal.amount}
                onChange={e => setVariableModal(v => v ? { ...v, amount: e.target.value } : null)}
                className="w-full px-3 py-2.5 rounded-xl border text-sm font-bold text-center"
                dir="ltr" style={{ background: 'var(--bg-input)', borderColor: 'var(--primary)', color: 'var(--text-main)', fontSize: '1.1rem' }}
                placeholder="0.00" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => setVariableModal(null)} className="py-2.5 rounded-xl text-sm font-bold" style={{ background: 'var(--bg-input)', color: 'var(--text-muted)' }}>إلغاء</button>
              <button onClick={handleConfirmVariable} disabled={processing} className="py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-1" style={{ background: 'var(--primary)', color: 'var(--text-on-primary)' }}>
                {processing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}تأكيد التسجيل
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Income Tab ── */}
      {tab === 'income' && (
        <div className="rounded-2xl border overflow-hidden" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-light)' }}>
          {/* Search/filter bar */}
          <div className="p-3 border-b flex flex-wrap items-center gap-2" style={{ borderColor: 'var(--border-light)', background: 'var(--bg-input)' }}>
            <div className="flex-1 min-w-[180px] relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none" style={{ color: 'var(--text-muted)' }} />
              <input value={incomeSearch} onChange={e => setIncomeSearch(e.target.value)} placeholder="بحث في الإيرادات..." className="w-full pr-9 pl-3 py-2 rounded-xl border text-sm" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)', color: 'var(--text-main)' }} />
            </div>
            <input type="date" value={incomeFromDate} onChange={e => setIncomeFromDate(e.target.value)} title="من تاريخ" className="px-3 py-2 rounded-xl border text-sm" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)', color: 'var(--text-main)' }} />
            <input type="date" value={incomeToDate} onChange={e => setIncomeToDate(e.target.value)} title="إلى تاريخ" className="px-3 py-2 rounded-xl border text-sm" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)', color: 'var(--text-main)' }} />
            {(incomeSearch || incomeFromDate || incomeToDate) && (
              <button onClick={() => { setIncomeSearch(''); setIncomeFromDate(''); setIncomeToDate('') }} className="px-3 py-2 rounded-xl text-xs font-bold" style={{ background: 'var(--border)', color: 'var(--text-muted)' }}>مسح الفلاتر</button>
            )}
            {filteredIncome.length !== incomeEntries.length && (
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>({filteredIncome.length} من {incomeEntries.length})</span>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-right">
              <thead><tr style={{ background: 'var(--bg-input)' }}>
                {['التاريخ', 'المصدر', 'المبلغ', 'ملاحظات', ''].map(h => <th key={h} className="px-4 py-3 text-xs font-bold" style={{ color: 'var(--text-muted)' }}>{h}</th>)}
              </tr></thead>
              <tbody>
                {filteredIncome.map(e => (
                  <tr key={e.id} className="border-t" style={{ borderColor: 'var(--border-light)' }}>
                    <td className="px-4 py-3 text-sm" style={{ color: 'var(--text-muted)' }}>{e.income_date}</td>
                    <td className="px-4 py-3 text-sm font-bold" style={{ color: 'var(--text-heading)' }}>{e.source}</td>
                    <td className="px-4 py-3 text-sm font-black" style={{ color: '#10b981' }}>{formatCurrency(Number(e.amount))}</td>
                    <td className="px-4 py-3 text-xs" style={{ color: 'var(--text-muted)' }}>{e.description || '—'}</td>
                    <td className="px-4 py-3"><div title="محمي من الحذف" className="p-1.5 rounded-lg flex items-center justify-center opacity-40" style={{ color: 'var(--text-muted)', background: 'var(--bg-input)' }}><Lock className="w-3.5 h-3.5" /></div></td>
                  </tr>
                ))}
                {filteredIncome.length === 0 && <tr><td colSpan={5} className="px-4 py-10 text-center text-sm" style={{ color: 'var(--text-muted)' }}>{incomeSearch || incomeFromDate || incomeToDate ? 'لا نتائج تطابق الفلتر' : 'لا توجد إيرادات مسجلة'}</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Expenses Tab ── */}
      {tab === 'expenses' && (
        <div className="rounded-2xl border overflow-hidden" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-light)' }}>
          {/* Search/filter bar */}
          <div className="p-3 border-b flex flex-wrap items-center gap-2" style={{ borderColor: 'var(--border-light)', background: 'var(--bg-input)' }}>
            <div className="flex-1 min-w-[180px] relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none" style={{ color: 'var(--text-muted)' }} />
              <input value={expenseSearch} onChange={e => setExpenseSearch(e.target.value)} placeholder="بحث في المصروفات..." className="w-full pr-9 pl-3 py-2 rounded-xl border text-sm" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)', color: 'var(--text-main)' }} />
            </div>
            <input type="date" value={expenseFromDate} onChange={e => setExpenseFromDate(e.target.value)} title="من تاريخ" className="px-3 py-2 rounded-xl border text-sm" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)', color: 'var(--text-main)' }} />
            <input type="date" value={expenseToDate} onChange={e => setExpenseToDate(e.target.value)} title="إلى تاريخ" className="px-3 py-2 rounded-xl border text-sm" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)', color: 'var(--text-main)' }} />
            {(expenseSearch || expenseFromDate || expenseToDate) && (
              <button onClick={() => { setExpenseSearch(''); setExpenseFromDate(''); setExpenseToDate('') }} className="px-3 py-2 rounded-xl text-xs font-bold" style={{ background: 'var(--border)', color: 'var(--text-muted)' }}>مسح الفلاتر</button>
            )}
            {filteredExpenses.length !== expenses.length && (
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>({filteredExpenses.length} من {expenses.length})</span>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-right">
              <thead><tr style={{ background: 'var(--bg-input)' }}>
                {['التاريخ', 'التصنيف', 'المبلغ', 'وصف', ''].map(h => <th key={h} className="px-4 py-3 text-xs font-bold" style={{ color: 'var(--text-muted)' }}>{h}</th>)}
              </tr></thead>
              <tbody>
                {filteredExpenses.map(e => (
                  <tr key={e.id} className="border-t" style={{ borderColor: 'var(--border-light)' }}>
                    <td className="px-4 py-3 text-sm" style={{ color: 'var(--text-muted)' }}>{e.expense_date}</td>
                    <td className="px-4 py-3"><span className="text-xs font-bold px-2 py-0.5 rounded-md" style={{ background: 'var(--bg-input)', color: 'var(--text-heading)' }}>{e.category}</span></td>
                    <td className="px-4 py-3 text-sm font-black" style={{ color: '#ef4444' }}>{formatCurrency(Number(e.amount))}</td>
                    <td className="px-4 py-3 text-xs" style={{ color: 'var(--text-muted)' }}>{e.description || '—'}</td>
                    <td className="px-4 py-3"><div title="محمي من الحذف" className="p-1.5 rounded-lg flex items-center justify-center opacity-40" style={{ color: 'var(--text-muted)', background: 'var(--bg-input)' }}><Lock className="w-3.5 h-3.5" /></div></td>
                  </tr>
                ))}
                {filteredExpenses.length === 0 && <tr><td colSpan={5} className="px-4 py-10 text-center text-sm" style={{ color: 'var(--text-muted)' }}>{expenseSearch || expenseFromDate || expenseToDate ? 'لا نتائج تطابق الفلتر' : 'لا توجد مصروفات مسجلة'}</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Recurring Tab ── */}
      {tab === 'recurring' && (
        <div className="space-y-3">
          {recurring.map(item => {
            const isExpanded = expandedRecurring === item.id
            const execLog: any[] = item.log || []
            const recurrenceLabel = item.recurrence_type === 'monthly' ? 'شهري' : item.recurrence_type === 'weekly' ? 'أسبوعي' : 'سنوي'
            const isDueToday = item.next_run_date && new Date(item.next_run_date) <= new Date()
            const isVariable = item.amount_type === 'variable'
            return (
              <div key={item.id} className="rounded-2xl border overflow-hidden" style={{ background: 'var(--bg-card)', borderColor: item.is_active ? 'var(--border-light)' : 'var(--border)' }}>
                <div className="p-4 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: item.type === 'expense' ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.1)' }}>
                    <Repeat className="w-5 h-5" style={{ color: item.type === 'expense' ? '#ef4444' : '#10b981' }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-bold" style={{ color: 'var(--text-heading)' }}>{item.name}</p>
                      <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: item.type === 'expense' ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.1)', color: item.type === 'expense' ? '#ef4444' : '#10b981' }}>{recurrenceLabel}</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: isVariable ? 'rgba(245,158,11,0.1)' : 'rgba(107,114,128,0.1)', color: isVariable ? '#d97706' : 'var(--text-muted)' }}>{isVariable ? 'متغير' : 'ثابت'}</span>
                      {!item.is_active && <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: 'var(--bg-input)', color: 'var(--text-muted)' }}>متوقف</span>}
                    </div>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{item.category} · نُفذ {item.total_runs || 0} مرة · مجموع {formatCurrency(Number(item.total_amount || 0))}</p>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>التالي: {item.next_run_date || '—'}</span>
                      {isDueToday && item.is_active && <span className="text-[10px] font-bold px-2 py-0.5 rounded" style={{ background: 'rgba(245,158,11,0.15)', color: '#d97706' }}>مستحق اليوم</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <p className="text-base font-black" style={{ color: item.type === 'expense' ? '#ef4444' : '#10b981' }}>
                      {isVariable ? <span className="text-sm" style={{ color: '#d97706' }}>متغير</span> : <>{item.type === 'expense' ? '−' : '+'}{formatCurrency(Number(item.amount))}</>}
                    </p>
                    {item.is_active && (
                      <button onClick={() => handleExecuteRecurring(item)} title={isVariable ? 'إدخال مبلغ الدورة' : 'تسجيل الآن'} className="p-2 rounded-xl" style={{ background: 'var(--primary)', color: 'var(--text-on-primary)' }}>
                        <RefreshCw className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button onClick={() => setExpandedRecurring(isExpanded ? null : item.id)} className="p-2 rounded-xl" style={{ background: 'var(--bg-input)', color: 'var(--text-muted)' }}>
                      {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </button>
                    {item.is_active && (
                      <button onClick={() => { deactivate(item.id); toast.success('تم إيقاف التشغيل') }} className="p-2 rounded-xl" style={{ background: 'rgba(239,68,68,0.08)', color: '#ef4444' }}>
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
                {isExpanded && execLog.length > 0 && (
                  <div className="border-t px-4 pb-3" style={{ borderColor: 'var(--border-light)' }}>
                    <p className="text-xs font-bold mt-3 mb-2" style={{ color: 'var(--text-muted)' }}>سجل التنفيذ</p>
                    <div className="space-y-1.5">
                      {execLog.slice(0, 6).map((log: any) => (
                        <div key={log.id} className="flex items-center justify-between text-xs py-1.5 px-3 rounded-lg" style={{ background: 'var(--bg-input)' }}>
                          <div className="flex items-center gap-2"><Calendar className="w-3 h-3" style={{ color: 'var(--text-muted)' }} /><span style={{ color: 'var(--text-muted)' }}>{log.run_date}</span></div>
                          <span className="font-bold" style={{ color: '#10b981' }}>{formatCurrency(Number(log.amount_posted))}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
          {recurring.length === 0 && (
            <div className="flex flex-col items-center py-16 opacity-40">
              <Repeat className="w-12 h-12 mb-3" style={{ color: 'var(--text-muted)' }} />
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>لا توجد معاملات متكررة</p>
            </div>
          )}
        </div>
      )}

      {/* ── P&L Tab ── */}
      {tab === 'pnl' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Income by source */}
            <div className="rounded-2xl border overflow-hidden" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-light)' }}>
              <div className="px-4 py-3 border-b flex items-center gap-2" style={{ borderColor: 'var(--border-light)', background: 'rgba(16,185,129,0.04)' }}>
                <TrendingUp className="w-4 h-4" style={{ color: '#10b981' }} />
                <p className="text-sm font-bold" style={{ color: 'var(--text-heading)' }}>الإيرادات حسب المصدر</p>
              </div>
              <div className="p-3 space-y-2">
                {incomeBySource.length === 0 && <p className="text-center py-6 text-sm" style={{ color: 'var(--text-muted)' }}>لا توجد بيانات</p>}
                {incomeBySource.map(([src, amt]) => (
                  <div key={src}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-bold" style={{ color: 'var(--text-heading)' }}>{src}</span>
                      <span className="font-black" style={{ color: '#10b981' }}>{formatCurrency(amt)}</span>
                    </div>
                    <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--bg-input)' }}>
                      <div className="h-full rounded-full" style={{ width: `${totalIncome > 0 ? (amt / totalIncome * 100) : 0}%`, background: '#10b981' }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Expenses by category */}
            <div className="rounded-2xl border overflow-hidden" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-light)' }}>
              <div className="px-4 py-3 border-b flex items-center gap-2" style={{ borderColor: 'var(--border-light)', background: 'rgba(239,68,68,0.04)' }}>
                <TrendingDown className="w-4 h-4" style={{ color: '#ef4444' }} />
                <p className="text-sm font-bold" style={{ color: 'var(--text-heading)' }}>المصروفات حسب التصنيف</p>
              </div>
              <div className="p-3 space-y-2">
                {expensesByCategory.length === 0 && <p className="text-center py-6 text-sm" style={{ color: 'var(--text-muted)' }}>لا توجد بيانات</p>}
                {expensesByCategory.map(([cat, amt]) => (
                  <div key={cat}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-bold" style={{ color: 'var(--text-heading)' }}>{cat}</span>
                      <span className="font-black" style={{ color: '#ef4444' }}>{formatCurrency(amt)}</span>
                    </div>
                    <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--bg-input)' }}>
                      <div className="h-full rounded-full" style={{ width: `${totalExpenses > 0 ? (amt / totalExpenses * 100) : 0}%`, background: '#ef4444' }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* P&L Statement */}
          <div className="rounded-2xl border overflow-hidden" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-light)' }}>
            <div className="px-4 py-3 border-b" style={{ borderColor: 'var(--border-light)' }}>
              <p className="text-sm font-bold" style={{ color: 'var(--text-heading)' }}>قائمة الأرباح والخسائر</p>
            </div>
            <div className="p-4 space-y-2">
              <div className="flex justify-between text-sm font-bold py-2 border-b" style={{ borderColor: 'var(--border-light)' }}>
                <span style={{ color: 'var(--text-heading)' }}>إجمالي الإيرادات</span>
                <span style={{ color: '#10b981' }}>{formatCurrency(totalIncome)}</span>
              </div>
              <div className="flex justify-between text-sm font-bold py-2 border-b" style={{ borderColor: 'var(--border-light)' }}>
                <span style={{ color: 'var(--text-heading)' }}>إجمالي المصروفات</span>
                <span style={{ color: '#ef4444' }}>({formatCurrency(totalExpenses)})</span>
              </div>
              <div className="flex justify-between text-base font-black py-2 rounded-xl px-3" style={{ background: netBalance >= 0 ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)' }}>
                <span style={{ color: 'var(--text-heading)' }}>صافي الربح / الخسارة</span>
                <span style={{ color: netBalance >= 0 ? '#10b981' : '#ef4444' }}>{netBalance >= 0 ? '+' : ''}{formatCurrency(netBalance)}</span>
              </div>
              {totalIncome > 0 && (
                <p className="text-xs text-center pt-1" style={{ color: 'var(--text-muted)' }}>
                  هامش الربح: <strong style={{ color: netBalance >= 0 ? '#10b981' : '#ef4444' }}>{((netBalance / totalIncome) * 100).toFixed(1)}%</strong>
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

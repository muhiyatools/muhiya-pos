import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type { Tables, TablesInsert } from '../lib/database.types'

// ─── المنتجات ───
export function useProducts() {
  const [products, setProducts] = useState<Tables<'products'>[]>([])
  const [loading, setLoading] = useState(true)
  const fetch = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('products').select('*, category:categories(*)').eq('is_active', true).is('deleted_at', null).order('name')
    if (data) setProducts(data)
    setLoading(false)
  }, [])
  useEffect(() => { let m = true; const f = async () => { if (m) await fetch() }; f(); return () => { m = false } }, [fetch])
  const add = async (p: TablesInsert<'products'>) => { const { data, error } = await supabase.from('products').insert(p).select().single(); if (!error && data) await fetch(); return { data, error } }
  const update = async (id: string, u: Partial<Tables<'products'>>) => { await supabase.from('products').update(u).eq('id', id); await fetch() }
  const remove = async (id: string) => { await supabase.from('products').update({ deleted_at: new Date().toISOString(), is_active: false }).eq('id', id); await fetch() }
  return { products, loading, fetch, add, update, remove }
}

// ─── التصنيفات ───
export function useCategories(appliesTo?: string) {
  const [categories, setCategories] = useState<Tables<'categories'>[]>([])
  const [loading, setLoading] = useState(true)
  const fetch = useCallback(async () => {
    setLoading(true)
    let q = supabase.from('categories').select('*').eq('is_active', true).is('deleted_at', null).order('sort_order').order('name')
    if (appliesTo && appliesTo !== 'all') q = q.or(`applies_to.eq.${appliesTo},applies_to.eq.all`)
    const { data } = await q
    if (data) setCategories(data)
    setLoading(false)
  }, [appliesTo])
  useEffect(() => { let m = true; const f = async () => { if (m) await fetch() }; f(); return () => { m = false } }, [fetch])
  const add = async (c: TablesInsert<'categories'>) => { const { data, error } = await supabase.from('categories').insert(c).select().single(); if (!error && data) await fetch(); return { data, error } }
  const update = async (id: string, u: Partial<Tables<'categories'>>) => { await supabase.from('categories').update(u).eq('id', id); await fetch() }
  const remove = async (id: string) => { await supabase.from('categories').update({ deleted_at: new Date().toISOString(), is_active: false }).eq('id', id); await fetch() }
  return { categories, loading, fetch, add, update, remove }
}

// ─── الدخل ───
export function useIncome(branchId?: string | null) {
  const [entries, setEntries] = useState<Tables<'income_entries'>[]>([])
  const [loading, setLoading] = useState(true)
  const fetch = useCallback(async () => {
    setLoading(true)
    let q = supabase.from('income_entries').select('*').is('deleted_at', null).order('income_date', { ascending: false }).limit(500)
    // Show entries for selected branch + entries with no branch (system-generated)
    if (branchId) q = q.or(`branch_id.eq.${branchId},branch_id.is.null`)
    const { data } = await q
    if (data) setEntries(data)
    setLoading(false)
  }, [branchId])
  useEffect(() => { let m = true; const f = async () => { if (m) await fetch() }; f(); return () => { m = false } }, [fetch])
  const add = async (e: TablesInsert<'income_entries'>) => { const { data, error } = await supabase.from('income_entries').insert(e).select().single(); if (!error && data) await fetch(); return { data, error } }
  const remove = async (id: string) => { await supabase.from('income_entries').delete().eq('id', id); await fetch() }
  return { entries, loading, fetch, add, remove, total: entries.reduce((s, e) => s + Number(e.amount), 0) }
}

// ─── المصروفات ───
export function useExpenses(branchId?: string | null) {
  const [expenses, setExpenses] = useState<Tables<'expenses'>[]>([])
  const [loading, setLoading] = useState(true)
  const fetch = useCallback(async () => {
    setLoading(true)
    let q = supabase.from('expenses').select('*').is('deleted_at', null).order('expense_date', { ascending: false }).limit(500)
    // Show expenses for selected branch + expenses with no branch (system-generated: returns, POs)
    if (branchId) q = q.or(`branch_id.eq.${branchId},branch_id.is.null`)
    const { data } = await q
    if (data) setExpenses(data)
    setLoading(false)
  }, [branchId])
  useEffect(() => { let m = true; const f = async () => { if (m) await fetch() }; f(); return () => { m = false } }, [fetch])
  const add = async (e: TablesInsert<'expenses'>) => { const { data, error } = await supabase.from('expenses').insert(e).select().single(); if (!error && data) await fetch(); return { data, error } }
  const update = async (id: string, u: Partial<Tables<'expenses'>>) => { await supabase.from('expenses').update(u).eq('id', id); await fetch() }
  const remove = async (id: string) => { await supabase.from('expenses').delete().eq('id', id); await fetch() }
  const approve = async (id: string, by: string) => { await supabase.from('expenses').update({ status: 'approved', approved_by: by, approved_at: new Date().toISOString() }).eq('id', id); await fetch() }
  return { expenses, loading, fetch, add, update, remove, approve, total: expenses.reduce((s, e) => s + Number(e.amount), 0), pending: expenses.filter(e => e.status === 'pending') }
}

// ─── العمليات (Orders) ───
export function useOrders(branchId?: string | null) {
  const [orders, setOrders] = useState<(Tables<'orders'> & { items: Tables<'order_items'>[] })[]>([])
  const [loading, setLoading] = useState(true)
  const fetch = useCallback(async () => {
    setLoading(true)
    let q = supabase.from('orders').select('*, items:order_items(*)').order('created_at', { ascending: false }).limit(200)
    if (branchId) q = q.eq('branch_id', branchId)
    const { data } = await q
    if (data) setOrders(data as any)
    setLoading(false)
  }, [branchId])
  useEffect(() => { let m = true; const f = async () => { if (m) await fetch() }; f(); return () => { m = false } }, [fetch])
  return { orders, loading, fetch }
}

// ─── العملاء ───
export function useCustomers() {
  const [customers, setCustomers] = useState<Tables<'customers'>[]>([])
  const [loading, setLoading] = useState(true)
  const fetch = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('customers').select('*').eq('is_active', true).order('name')
    if (data) setCustomers(data)
    setLoading(false)
  }, [])
  useEffect(() => { let m = true; const f = async () => { if (m) await fetch() }; f(); return () => { m = false } }, [fetch])
  const add = async (c: TablesInsert<'customers'>) => { const { data, error } = await supabase.from('customers').insert(c).select().single(); if (!error && data) await fetch(); return { data, error } }
  const update = async (id: string, u: Partial<Tables<'customers'>>) => { await supabase.from('customers').update(u).eq('id', id); await fetch() }
  return { customers, loading, fetch, add, update }
}

// ─── المستخدمين والأدوار ───
export function useUsers() {
  const [users, setUsers] = useState<(Tables<'users'> & { roles: { name: string }[] })[]>([])
  const [loading, setLoading] = useState(true)
  const fetch = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('users').select('*, user_roles(role:roles(id, name))').order('full_name')
    if (data) {
      const normalized = (data as any[]).map((user) => ({
        ...user,
        roles: (user.user_roles || []).flatMap((link: any) => {
          if (!link?.role) return []
          if (Array.isArray(link.role)) return link.role
          return [link.role]
        }),
      }))
      setUsers(normalized as any)
    }
    setLoading(false)
  }, [])
  useEffect(() => { let m = true; const f = async () => { if (m) await fetch() }; f(); return () => { m = false } }, [fetch])
  const add = async (u: TablesInsert<'users'>) => { const { data, error } = await supabase.from('users').insert(u).select().single(); if (!error && data) await fetch(); return { data, error } }
  const update = async (id: string, u: Partial<Tables<'users'>>) => { await supabase.from('users').update(u).eq('id', id); await fetch() }
  return { users, loading, fetch, add, update }
}

export function useRoles() {
  const [roles, setRoles] = useState<(Tables<'roles'> & { permissions: Tables<'role_permissions'>[] })[]>([])
  const [loading, setLoading] = useState(true)
  const fetch = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('roles').select('*, permissions:role_permissions(*)')
    if (data) setRoles(data as any)
    setLoading(false)
  }, [])
  useEffect(() => { let m = true; const f = async () => { if (m) await fetch() }; f(); return () => { m = false } }, [fetch])
  const add = async (r: TablesInsert<'roles'>) => { const { data, error } = await supabase.from('roles').insert(r).select().single(); if (!error && data) await fetch(); return { data, error } }
  const updatePerm = async (roleId: string, module: string, perms: { can_view: boolean; can_create: boolean; can_edit: boolean; can_delete: boolean }) => {
    const { data: existing } = await supabase.from('role_permissions').select('*').eq('role_id', roleId).eq('module', module).maybeSingle()
    if (existing) await supabase.from('role_permissions').update(perms).eq('id', existing.id)
    else await supabase.from('role_permissions').insert({ role_id: roleId, module, ...perms })
    await fetch()
  }
  return { roles, loading, fetch, add, updatePerm }
}

// ─── المؤسسة ──
export function useOrganization() {
  const [org, setOrg] = useState<Tables<'organization_profile'> | null>(null)
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    let m = true
    const f = async () => {
      setLoading(true)
      const { data } = await supabase.from('organization_profile').select('*').limit(1).maybeSingle()
      if (data && m) {
        setOrg(data)
        // Cache org info for login page (anon users can't query DB)
        try {
          const orgAny = data as any
          localStorage.setItem('app_org_cache', JSON.stringify({
            name: data.name, logo_url: data.logo_url, phone: data.phone, address: data.address,
            tax_rate: orgAny?.tax_rate ?? 14, currency_symbol: orgAny?.currency_symbol || 'ج.م',
          }))
        } catch {}
      }
      setLoading(false)
    }
    f(); return () => { m = false }
  }, [])
  const update = async (u: Partial<Tables<'organization_profile'>>) => {
    if (org) await supabase.from('organization_profile').update(u).eq('id', org.id)
    else { const { data } = await supabase.from('organization_profile').insert({ name: 'المؤسسة', ...u }).select().single(); if (data) setOrg(data) }
    setOrg(p => p ? { ...p, ...u } : null)
  }
  return { org, loading, update }
}

export function useCompanyProfile(tenantId?: string | null) {
  const [company, setCompany] = useState<any | null>(null)
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    setLoading(true)
    try {
      let companiesQ = (supabase as any).from('companies').select('*').order('created_at', { ascending: false }).limit(1)
      if (tenantId) companiesQ = companiesQ.eq('tenant_id', tenantId)
      const companiesRes = await companiesQ.maybeSingle()

      if (!companiesRes.error && companiesRes.data) {
        setCompany(companiesRes.data)
        setLoading(false)
        return
      }
    } catch {
      // Fall back to organization profile if companies table is not available in this project.
    }

    let orgQ = supabase.from('organization_profile').select('*').order('created_at', { ascending: false }).limit(1)
    if (tenantId) orgQ = orgQ.eq('tenant_id', tenantId)
    const { data } = await orgQ.maybeSingle()
    setCompany(data || null)
    setLoading(false)
  }, [tenantId])

  useEffect(() => {
    let mounted = true
    const run = async () => {
      if (!mounted) return
      await fetch()
    }
    run()
    return () => { mounted = false }
  }, [fetch])

  return { company, loading, refetch: fetch }
}

// ─── الإحصائيات السريعة ───
export function useStats(branchId?: string | null) {
  const [stats, setStats] = useState({ totalRevenue: 0, totalOtherIncome: 0, totalExpenses: 0, netProfit: 0, totalOrders: 0, totalProducts: 0, totalCustomers: 0, todayRevenue: 0, todayOtherIncome: 0, todayOrders: 0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let m = true
    const f = async () => {
      setLoading(true)
      const today = new Date().toISOString().split('T')[0]
      const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0]

      let qOtherIncome = supabase.from('income_entries').select('amount').is('deleted_at', null).neq('source', 'sales')
      let qExp = supabase.from('expenses').select('amount').is('deleted_at', null)
      let qOrd = supabase.from('orders').select('id')
      let qCompleted = supabase.from('orders').select('total').eq('status', 'completed')
      let qTodayOI = supabase.from('income_entries').select('amount').is('deleted_at', null).eq('income_date', today).neq('source', 'sales')
      let qTodayComp = supabase.from('orders').select('total').eq('status', 'completed').gte('created_at', today).lt('created_at', tomorrow)
      let qTodayOrd = supabase.from('orders').select('id').gte('created_at', today).lt('created_at', tomorrow)

      if (branchId) {
        qOtherIncome = qOtherIncome.or(`branch_id.eq.${branchId},branch_id.is.null`)
        qExp = qExp.or(`branch_id.eq.${branchId},branch_id.is.null`)
        qOrd = qOrd.eq('branch_id', branchId)
        qCompleted = qCompleted.eq('branch_id', branchId)
        qTodayOI = qTodayOI.or(`branch_id.eq.${branchId},branch_id.is.null`)
        qTodayComp = qTodayComp.eq('branch_id', branchId)
        qTodayOrd = qTodayOrd.eq('branch_id', branchId)
      }

      const [otherIncome, exp, ord, completedOrders, prod, cust, todayOtherIncome, todayCompletedOrders, todayOrd] = await Promise.all([
        qOtherIncome,
        qExp,
        qOrd,
        qCompleted,
        supabase.from('products').select('id').eq('is_active', true),
        supabase.from('customers').select('id').eq('is_active', true),
        qTodayOI,
        qTodayComp,
        qTodayOrd,
      ])
      const totalSales = (completedOrders.data || []).reduce((sum: number, entry: any) => sum + (entry.total || 0), 0)
      const totalOtherIncome = (otherIncome.data || []).reduce((sum: number, entry: any) => sum + (entry.amount || 0), 0)
      const totalExpenses = (exp.data || []).reduce((sum: number, entry: any) => sum + (entry.amount || 0), 0)
      const todaySales = (todayCompletedOrders.data || []).reduce((sum: number, entry: any) => sum + (entry.total || 0), 0)
      const todayOther = (todayOtherIncome.data || []).reduce((sum: number, entry: any) => sum + (entry.amount || 0), 0)
      if (m) setStats({
        totalRevenue: totalSales,
        totalOtherIncome,
        totalExpenses,
        netProfit: totalSales + totalOtherIncome - totalExpenses,
        totalOrders: (ord.data || []).length,
        totalProducts: (prod.data || []).length,
        totalCustomers: (cust.data || []).length,
        todayRevenue: todaySales,
        todayOtherIncome: todayOther,
        todayOrders: (todayOrd.data || []).length,
      })
      setLoading(false)
    }
    f()
    return () => { m = false }
  }, [branchId])

  return { stats, loading }
}

// ─── المعاملات المتكررة ───
export function useRecurring() {
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('recurring_transactions').select('*, log:recurring_execution_log(*)').order('created_at', { ascending: false })
    if (data) setItems(data)
    setLoading(false)
  }, [])

  useEffect(() => { let m = true; const f = async () => { if (m) await fetch() }; f(); return () => { m = false } }, [fetch])

  const add = async (r: any) => {
    const { data, error } = await supabase.from('recurring_transactions').insert(r).select().single()
    if (!error && data) await fetch()
    return { data, error }
  }

  const update = async (id: string, u: any) => {
    await supabase.from('recurring_transactions').update(u).eq('id', id)
    await fetch()
  }

  const deactivate = async (id: string) => {
    await supabase.from('recurring_transactions').update({ is_active: false }).eq('id', id)
    await fetch()
  }

  /** Execute a recurring item: inserts a real expense/income for this period */
  const execute = async (item: any) => {
    const today = new Date().toISOString().split('T')[0]
    if (item.type === 'expense') {
      await supabase.from('expenses').insert({
        category: item.category, amount: item.amount, description: item.name,
        expense_date: today, status: 'paid', is_recurring: true, recurring_pattern: item.recurrence_type,
        created_by: 'system',
      })
    } else {
      await supabase.from('income_entries').insert({
        source: item.category, amount: item.amount, description: item.name,
        income_date: today, is_recurring: true, recurring_pattern: item.recurrence_type,
      })
    }
    // Log execution
    await supabase.from('recurring_execution_log').insert({
      recurring_id: item.id, run_date: today, amount_posted: item.amount, status: 'success',
    })
    // Update next run date + totals
    const nextDate = new Date(today)
    if (item.recurrence_type === 'monthly') nextDate.setMonth(nextDate.getMonth() + 1)
    else if (item.recurrence_type === 'weekly') nextDate.setDate(nextDate.getDate() + 7)
    else nextDate.setFullYear(nextDate.getFullYear() + 1)

    await supabase.from('recurring_transactions').update({
      last_run_date: today, next_run_date: nextDate.toISOString().split('T')[0],
      total_runs: (item.total_runs || 0) + 1, total_amount: (item.total_amount || 0) + item.amount,
    }).eq('id', item.id)
    await fetch()
  }

  return { items, loading, fetch, add, update, deactivate, execute }
}


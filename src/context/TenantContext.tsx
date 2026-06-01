import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { supabase as typedSupabase } from '../lib/supabase'
import { useAuth } from './AuthContext'

const supabase = typedSupabase as any

export interface Tenant {
  id: string
  name: string
  slug: string
  plan: string
  max_branches: number
  max_users: number
  is_active: boolean
  settings: Record<string, any>
}

export interface Branch {
  id: string
  tenant_id: string
  name: string
  address: string | null
  phone: string | null
  is_main: boolean
  is_active: boolean
}

interface TenantContextType {
  tenant: Tenant | null
  branches: Branch[]
  currentBranch: Branch | null
  loading: boolean
  setCurrentBranch: (b: Branch) => void
  refetchBranches: () => Promise<void>
}

const TenantContext = createContext<TenantContextType | undefined>(undefined)

export function TenantProvider({ children }: { children: React.ReactNode }) {
  const { user, currentUser, isAdmin } = useAuth()
  const [tenant, setTenant] = useState<Tenant | null>(null)
  const [branches, setBranches] = useState<Branch[]>([])
  const [currentBranch, setCurrentBranch] = useState<Branch | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchTenantData = useCallback(async () => {
    if (!user) { setLoading(false); return }

    setLoading(true)
    try {
      // Try to find tenant for this user via users table
      const { data: userData } = await supabase
        .from('users')
        .select('tenant_id, branch_id')
        .eq('email', user.email || '')
        .maybeSingle()

      let tenantId = userData?.tenant_id

      // If no tenant assigned, check if any tenant exists (single-tenant mode)
      if (!tenantId) {
        const { data: firstTenant } = await supabase
          .from('tenants')
          .select('*')
          .limit(1)
          .maybeSingle()

        if (firstTenant) {
          tenantId = firstTenant.id
          setTenant(firstTenant as Tenant)
          await supabase.from('users').update({ tenant_id: firstTenant.id } as any).eq('email', user.email || '')
        } else {
          // Auto-create a default tenant for the first user
          const { data: newTenant } = await supabase
            .from('tenants')
            .insert({
              name: 'مؤسسة جديدة',
              slug: 'tenant-' + Date.now(),
              plan: 'free',
              owner_email: user.email || '',
            })
            .select()
            .single()

          if (newTenant) {
            tenantId = newTenant.id
            setTenant(newTenant as Tenant)
            await supabase.from('users').update({ tenant_id: newTenant.id } as any).eq('email', user.email || '')

            // Create default main branch
            const { data: insertedBranch } = await supabase.from('branches').insert({
              tenant_id: newTenant.id,
              name: 'الفرع الرئيسي',
              is_main: true,
            }).select('id').single()

            if (insertedBranch) {
              await supabase.from('warehouses').insert({
                tenant_id: newTenant.id,
                branch_id: insertedBranch.id,
                name: 'المخزن الرئيسي',
              })
            }
          }
        }
      } else {
        const { data: t } = await supabase
          .from('tenants')
          .select('*')
          .eq('id', tenantId)
          .single()
        if (t) setTenant(t as Tenant)
      }

      // Fetch branches
      if (tenantId) {
        const { data: br } = await supabase
          .from('branches')
          .select('*')
          .eq('tenant_id', tenantId)
          .eq('is_active', true)
          .order('is_main', { ascending: false })
          .order('name')

        if (br) {
          setBranches(br as Branch[])
          // Non-admin users are locked to their assigned branch.
          const assignedBranchId = currentUser?.branch_id || userData?.branch_id || null
          if (!isAdmin && assignedBranchId) {
            const assigned = br.find((branch: Branch) => branch.id === assignedBranchId)
            if (assigned) {
              setCurrentBranch(assigned as Branch)
              localStorage.setItem('selected_branch_id', assigned.id)
              setLoading(false)
              return
            }
          }

          // Admin can switch branches manually.
          const saved = localStorage.getItem('selected_branch_id')
          const match = br.find((branch: Branch) => branch.id === saved) || br.find((branch: Branch) => branch.is_main) || br[0]
          if (match) setCurrentBranch(match as Branch)
        }
      }
    } catch (err) {
      console.warn('[tenant] fetch error:', err)
    }
    setLoading(false)
  }, [user, currentUser?.branch_id, isAdmin])

  useEffect(() => { fetchTenantData() }, [fetchTenantData])

  const handleSetBranch = (b: Branch) => {
    if (!isAdmin) return
    setCurrentBranch(b)
    localStorage.setItem('selected_branch_id', b.id)
  }

  const refetchBranches = async () => {
    if (!tenant) return
    const { data } = await supabase
      .from('branches')
      .select('*')
      .eq('tenant_id', tenant.id)
      .eq('is_active', true)
      .order('is_main', { ascending: false })
      .order('name')
    if (data) setBranches(data as Branch[])
  }

  return (
    <TenantContext.Provider value={{ tenant, branches, currentBranch, loading, setCurrentBranch: handleSetBranch, refetchBranches }}>
      {children}
    </TenantContext.Provider>
  )
}

export function useTenant() {
  const ctx = useContext(TenantContext)
  if (!ctx) throw new Error('useTenant must be used within TenantProvider')
  return ctx
}

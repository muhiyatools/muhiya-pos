import { useState, useEffect, createContext, useContext, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type { AuthChangeEvent, Session, User } from '@supabase/supabase-js'

export interface AppUserRole {
  id: string
  name: string
}

export interface PermissionFlags {
  can_view: boolean
  can_create: boolean
  can_edit: boolean
  can_delete: boolean
}

export interface AppUser {
  id: string
  email: string
  full_name: string
  is_active: boolean
  avatar_url?: string | null
  last_login?: string | null
  phone?: string | null
  role_name?: string | null
  tenant_id?: string | null
  branch_id?: string | null
  auth_user_id?: string | null
  roles: AppUserRole[]
  permissions: Record<string, PermissionFlags>
}

export interface AuthContextType {
  user: User | null
  session: Session | null
  currentUser: AppUser | null
  isAdmin: boolean
  hasPermission: (module: string, action?: keyof PermissionFlags) => boolean
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined)

function normalizeRoles(userRoles: any[] | null | undefined): AppUserRole[] {
  if (!userRoles) return []
  return userRoles.flatMap((link) => {
    if (!link?.role) return []
    if (Array.isArray(link.role)) return link.role.map((role: any) => ({ id: role.id, name: role.name }))
    return [{ id: link.role.id, name: link.role.name }]
  })
}

function normalizeAppUser(record: any, permissions?: Record<string, PermissionFlags>): AppUser {
  return {
    id: record.id,
    email: record.email,
    full_name: record.full_name,
    is_active: record.is_active,
    avatar_url: record.avatar_url ?? null,
    last_login: record.last_login ?? null,
    phone: record.phone ?? null,
    role_name: record.role_name ?? null,
    tenant_id: record.tenant_id ?? null,
    branch_id: record.branch_id ?? null,
    auth_user_id: record.auth_user_id ?? null,
    roles: normalizeRoles(record.user_roles),
    permissions: permissions || {},
  }
}

async function loadUserPermissions(userId: string): Promise<Record<string, PermissionFlags>> {
  const { data: userRoles } = await supabase
    .from('user_roles')
    .select('role_id')
    .eq('user_id', userId)

  if (!userRoles || userRoles.length === 0) return {}

  const roleIds = userRoles.map((ur: any) => ur.role_id)
  const { data: perms } = await supabase
    .from('role_permissions')
    .select('module, can_view, can_create, can_edit, can_delete')
    .in('role_id', roleIds)

  if (!perms) return {}

  const merged: Record<string, PermissionFlags> = {}
  for (const p of perms as any[]) {
    if (!merged[p.module]) {
      merged[p.module] = { can_view: false, can_create: false, can_edit: false, can_delete: false }
    }
    // Merge: most permissive wins across roles
    if (p.can_view) merged[p.module].can_view = true
    if (p.can_create) merged[p.module].can_create = true
    if (p.can_edit) merged[p.module].can_edit = true
    if (p.can_delete) merged[p.module].can_delete = true
  }
  return merged
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null)
  const [loading, setLoading] = useState(true)

  const syncCurrentUser = useCallback(async (authUser: User | null) => {
    if (!authUser?.email) {
      setCurrentUser(null)
      return
    }

    const email = authUser.email
    const fullName = authUser.user_metadata?.full_name || authUser.user_metadata?.name || email.split('@')[0] || 'مستخدم'
    const avatarUrl = authUser.user_metadata?.avatar_url || authUser.user_metadata?.picture || null

    try {
      const [{ data: firstTenant }, { data: existingAdmin }] = await Promise.all([
        supabase.from('tenants').select('id').limit(1).maybeSingle(),
        supabase.from('users').select('id, email, role_name').eq('role_name', 'مدير النظام').limit(1).maybeSingle(),
      ])

      const { data: existingUser } = await supabase
        .from('users')
        .select('*, user_roles(role:roles(id, name))')
        .eq('email', email)
        .maybeSingle()

      const shouldBeOwner = !existingAdmin || existingAdmin.email === email || existingUser?.role_name === 'مدير النظام'

      const payload: any = {
        email,
        full_name: fullName,
        is_active: true,
        auth_user_id: authUser.id,
        last_login: new Date().toISOString(),
      }

      if (avatarUrl) payload.avatar_url = avatarUrl
      if (!existingUser?.tenant_id && firstTenant?.id) payload.tenant_id = firstTenant.id
      if (shouldBeOwner) payload.role_name = 'مدير النظام'

      const { data: savedUser, error: saveError } = existingUser
        ? await supabase.from('users').update(payload).eq('id', existingUser.id).select('*, user_roles(role:roles(id, name))').single()
        : await supabase.from('users').insert({ ...payload, role_name: payload.role_name || 'كاشير' }).select('*, user_roles(role:roles(id, name))').single()

      if (saveError || !savedUser) {
        console.warn('[auth] failed to sync app user:', saveError)
        if (existingUser) {
          const perms = await loadUserPermissions(existingUser.id)
          setCurrentUser(normalizeAppUser(existingUser, perms))
        } else {
          setCurrentUser(null)
        }
        return
      }

      if (shouldBeOwner) {
        const { data: adminRole } = await supabase.from('roles').select('id, name').eq('name', 'مدير النظام').maybeSingle()
        if (adminRole) {
          const { data: existingLink } = await supabase
            .from('user_roles')
            .select('id')
            .eq('user_id', savedUser.id)
            .eq('role_id', adminRole.id)
            .maybeSingle()

          if (!existingLink) {
            await supabase.from('user_roles').insert({ user_id: savedUser.id, role_id: adminRole.id })
          }
        }
      }

      const { data: refreshedUser } = await supabase
        .from('users')
        .select('*, user_roles(role:roles(id, name))')
        .eq('id', savedUser.id)
        .single()

      const finalUser = refreshedUser || savedUser
      const perms = await loadUserPermissions(finalUser.id)
      setCurrentUser(normalizeAppUser(finalUser, perms))
    } catch (error) {
      console.warn('[auth] bootstrap error:', error)
      setCurrentUser(null)
    }
  }, [])

  const refreshProfile = useCallback(async () => {
    await syncCurrentUser(user)
  }, [syncCurrentUser, user])

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(async ({ data: { session } }: { data: { session: Session | null } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      await syncCurrentUser(session?.user ?? null)
      setLoading(false)
    })

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event: AuthChangeEvent, session: Session | null) => {
      void (async () => {
        setSession(session)
        setUser(session?.user ?? null)
        await syncCurrentUser(session?.user ?? null)
        setLoading(false)
      })()
    })

    return () => subscription.unsubscribe()
  }, [syncCurrentUser])

  // ── Session timeout: auto-logout after 3 hours of inactivity ──
  useEffect(() => {
    const TIMEOUT_MS = 3 * 60 * 60 * 1000 // 3 hours
    let timer: ReturnType<typeof setTimeout>

    const resetTimer = () => {
      clearTimeout(timer)
      timer = setTimeout(async () => {
        await supabase.auth.signOut()
        setCurrentUser(null)
        setUser(null)
        setSession(null)
      }, TIMEOUT_MS)
    }

    const events = ['mousedown', 'keydown', 'touchstart', 'scroll']
    events.forEach(e => window.addEventListener(e, resetTimer, { passive: true }))
    resetTimer()

    return () => {
      clearTimeout(timer)
      events.forEach(e => window.removeEventListener(e, resetTimer))
    }
  }, [])

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error }
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    setCurrentUser(null)
    setUser(null)
    setSession(null)
  }

  const isAdmin = Boolean(currentUser?.role_name === 'مدير النظام' || currentUser?.roles.some((role) => role.name === 'مدير النظام'))

  const hasPermission = useCallback((module: string, action: keyof PermissionFlags = 'can_view') => {
    if (isAdmin) return true
    const perms = currentUser?.permissions
    if (!perms || !perms[module]) return false
    return perms[module][action]
  }, [isAdmin, currentUser?.permissions])

  return (
    <AuthContext.Provider value={{ user, session, currentUser, isAdmin, hasPermission, loading, signIn, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}


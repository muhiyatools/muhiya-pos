import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export type ThemePreset = 'dark' | 'light' | 'custom'

export interface ThemeColors {
  primaryColor: string
  secondaryColor: string
  accentColor: string
  dangerColor: string
  successColor: string
  bgMain: string
  bgCard: string
  bgSidebar: string
  bgInput: string
  textMain: string
  textHeading: string
  textMuted: string
  textOnPrimary: string
  textOnSidebar: string
  borderColor: string
  borderLight: string
  cornerRadius: number
  isDark: boolean
}

export interface ThemeConfig extends ThemeColors {
  companyName: string
  logoUrl: string
  taxRate: number
  currencySymbol: string
}

export interface ThemeStore extends ThemeConfig {
  activePreset: ThemePreset
  isLoading: boolean
  isDbLoaded: boolean
  dbThemeId: string | null
  setTheme: (s: Partial<ThemeConfig>) => void
  switchPreset: (p: ThemePreset) => void
  applyToDOM: () => void
  saveToDB: (tenantId?: string) => Promise<void>
  loadFromDB: (tenantId?: string) => Promise<void>
  setTenantId: (tenantId: string) => void
}

const darkTheme: ThemeColors = {
  primaryColor: '#10b981',
  secondaryColor: '#059669',
  accentColor: '#f59e0b',
  dangerColor: '#ef4444',
  successColor: '#10b981',
  bgMain: '#09090b',
  bgCard: '#18181b',
  bgSidebar: '#0c0c0e',
  bgInput: '#27272a',
  textMain: '#e4e4e7',
  textHeading: '#fafafa',
  textMuted: '#a1a1aa',
  textOnPrimary: '#022c22',
  textOnSidebar: '#a1a1aa',
  borderColor: '#27272a',
  borderLight: '#1e1e22',
  cornerRadius: 12,
  isDark: true,
}

const lightTheme: ThemeColors = {
  primaryColor: '#10b981', secondaryColor: '#059669', accentColor: '#f59e0b',
  dangerColor: '#ef4444', successColor: '#10b981', bgMain: '#f4f4f5',
  bgCard: '#ffffff', bgSidebar: '#18181b', bgInput: '#f4f4f5',
  textMain: '#18181b', textHeading: '#09090b', textMuted: '#71717a',
  textOnPrimary: '#022c22', textOnSidebar: '#a1a1aa',
  borderColor: '#e4e4e7', borderLight: '#f4f4f5', cornerRadius: 12, isDark: false,
}

const presets: Record<Exclude<ThemePreset, 'custom'>, ThemeColors> = { dark: darkTheme, light: lightTheme }

const defaultConfig: ThemeConfig = {
  ...darkTheme,
  companyName: 'منشأتي', logoUrl: '', taxRate: 14, currencySymbol: 'ج.م',
}

function dbToTheme(row: any): ThemeColors {
  return {
    primaryColor: row.primary_color || defaultConfig.primaryColor,
    secondaryColor: row.secondary_color || defaultConfig.secondaryColor,
    accentColor: row.accent_color || defaultConfig.accentColor,
    dangerColor: row.danger_color || defaultConfig.dangerColor,
    successColor: row.success_color || defaultConfig.successColor,
    bgMain: row.background || defaultConfig.bgMain,
    bgCard: row.surface || defaultConfig.bgCard,
    bgSidebar: row.sidebar_bg || defaultConfig.bgSidebar,
    bgInput: row.is_dark ? '#27272a' : '#f4f4f5',
    textMain: row.text_color || defaultConfig.textMain,
    textHeading: row.is_dark ? '#fafafa' : '#09090b',
    textMuted: row.is_dark ? '#a1a1aa' : '#71717a',
    textOnPrimary: row.is_dark ? '#022c22' : '#fff',
    textOnSidebar: '#a1a1aa',
    borderColor: row.is_dark ? '#27272a' : '#e4e4e7',
    borderLight: row.is_dark ? '#1e1e22' : '#f4f4f5',
    cornerRadius: row.corner_radius ?? defaultConfig.cornerRadius,
    isDark: row.is_dark ?? false,
  }
}

function themeToDb(s: ThemeStore) {
  return {
    name: 'مخصص',
    primary_color: s.primaryColor,
    secondary_color: s.secondaryColor,
    accent_color: s.accentColor,
    danger_color: s.dangerColor,
    success_color: s.successColor,
    background: s.bgMain,
    surface: s.bgCard,
    sidebar_bg: s.bgSidebar,
    text_color: s.textMain,
    corner_radius: s.cornerRadius,
    is_dark: s.isDark,
    is_default: false,
    is_active: true,
  }
}

function cacheToLocal(s: ThemeStore) {
  try {
    localStorage.setItem('app_theme', JSON.stringify(themeToDb(s)))
  } catch { /* localStorage unavailable */ }
}

const listeners = new Set<(s: ThemeStore) => void>()
let store: ThemeStore

function notify() { listeners.forEach(fn => fn(store)) }

function createDefault(): ThemeStore {
  return {
    ...defaultConfig,
    activePreset: 'dark',
    isLoading: false, isDbLoaded: false, dbThemeId: null,
    setTheme: () => {}, switchPreset: () => {}, applyToDOM: () => {},
    saveToDB: async () => {}, loadFromDB: async () => {}, setTenantId: () => {},
  }
}

export function useThemeStore(): ThemeStore {
  const [state, setState] = useState<ThemeStore>(() => store || createDefault())

  useEffect(() => {
    const h = (s: ThemeStore) => setState({ ...s })
    listeners.add(h)
    return () => { listeners.delete(h) }
  }, [])

  return state
}

export function initThemeStore() {
  const s = { ...defaultConfig, activePreset: 'dark' as ThemePreset, isLoading: false, isDbLoaded: false, dbThemeId: null as string | null, _tenantId: null as string | null }

  const setDOM = () => {
    const r = document.documentElement
    r.style.setProperty('--primary', s.primaryColor)
    r.style.setProperty('--secondary', s.secondaryColor)
    r.style.setProperty('--accent', s.accentColor)
    r.style.setProperty('--danger', s.dangerColor)
    r.style.setProperty('--success', s.successColor)
    r.style.setProperty('--bg-main', s.bgMain)
    r.style.setProperty('--bg-card', s.bgCard)
    r.style.setProperty('--bg-sidebar', s.bgSidebar)
    r.style.setProperty('--bg-input', s.bgInput)
    r.style.setProperty('--text-main', s.textMain)
    r.style.setProperty('--text-heading', s.textHeading)
    r.style.setProperty('--text-muted', s.textMuted)
    r.style.setProperty('--text-on-primary', s.textOnPrimary)
    r.style.setProperty('--text-on-sidebar', s.textOnSidebar)
    r.style.setProperty('--border', s.borderColor)
    r.style.setProperty('--border-light', s.borderLight)
    r.style.setProperty('--radius', `${s.cornerRadius}px`)
    r.style.setProperty('--radius-sm', `${Math.max(4, s.cornerRadius - 4)}px`)
    r.style.setProperty('--radius-xs', `${Math.max(2, s.cornerRadius - 8)}px`)
  }

  const saveDB = async (tenantId?: string) => {
    // Always cache to localStorage as a fast fallback
    cacheToLocal(s)

    // Persist to Supabase if tenant is known (use stored tenantId as fallback)
    const effectiveTenantId = tenantId || s._tenantId
    if (effectiveTenantId) {
      try {
        const payload = { ...themeToDb(s), tenant_id: effectiveTenantId }
        // Try to find existing theme for this tenant
        const { data: existing } = await supabase
          .from('themes')
          .select('id')
          .eq('tenant_id', effectiveTenantId)
          .eq('is_active', true)
          .maybeSingle()

        if (existing?.id) {
          await supabase.from('themes').update(payload).eq('id', existing.id)
          s.dbThemeId = existing.id
        } else {
          const { data: inserted } = await supabase
            .from('themes')
            .insert(payload)
            .select('id')
            .single()
          if (inserted?.id) s.dbThemeId = inserted.id
        }
      } catch (err) {
        console.warn('[theme] save to Supabase failed, using localStorage:', err)
      }
    }
  }

  store = {
    ...s,
    setTheme: (u) => {
      Object.assign(s, u)
      s.activePreset = 'custom'
      setDOM()
      notify()
      clearTimeout((s as any)._t)
      ;(s as any)._t = setTimeout(() => saveDB(), 500)
    },
    switchPreset: (p) => {
      if (p !== 'custom') { Object.assign(s, presets[p]); s.activePreset = p }
      else s.activePreset = 'custom'
      setDOM()
      notify()
      clearTimeout((s as any)._t)
      ;(s as any)._t = setTimeout(() => saveDB(), 500)
    },
    applyToDOM: setDOM,
    saveToDB: saveDB,
    setTenantId: (tenantId: string) => {
      s._tenantId = tenantId
      // Re-load theme from Supabase with the new tenant
      saveDB()
    },
    loadFromDB: async (tenantId?: string) => {
      s.isLoading = true
      if (tenantId) s._tenantId = tenantId
      notify()

      let loaded = false

      // 1. Try Supabase first if tenant is known
      if (tenantId) {
        try {
          const { data: themeRow } = await supabase
            .from('themes')
            .select('*')
            .eq('tenant_id', tenantId)
            .eq('is_active', true)
            .order('updated_at', { ascending: false })
            .limit(1)
            .maybeSingle()

          if (themeRow) {
            Object.assign(s, dbToTheme(themeRow))
            s.dbThemeId = themeRow.id
            s.isDbLoaded = true
            loaded = true
            // Sync to localStorage cache
            cacheToLocal(s)
          }
        } catch {
          // Fall through to localStorage
        }
      }

      // 2. Fall back to localStorage
      if (!loaded) {
        try {
          const raw = localStorage.getItem('app_theme')
          const data = raw ? JSON.parse(raw) : null
          if (data) {
            Object.assign(s, dbToTheme(data))
            s.isDbLoaded = true
          }
        } catch { /* localStorage unavailable */ }
      }

      // 3. Load company info from localStorage cache
      try {
        const orgRaw = localStorage.getItem('app_org_cache')
        if (orgRaw) {
          const orgData = JSON.parse(orgRaw)
          if (orgData.name) s.companyName = orgData.name
          if (orgData.logo_url) s.logoUrl = orgData.logo_url
          if (orgData.tax_rate != null) s.taxRate = orgData.tax_rate
          if (orgData.currency_symbol) s.currencySymbol = orgData.currency_symbol
        }
      } catch { /* localStorage unavailable */ }

      setDOM()
      s.isLoading = false
      notify()
    },
  }

  notify()
  return store
}

export { presets, defaultConfig }

import { useState, useEffect } from 'react'
import { useToast } from '../context/ToastContext'
import { useThemeStore, type ThemePreset } from '../store/useThemeStore'
import { useOrganization } from '../hooks/useData'
import { testETAConnection } from '../lib/einvoice'
import { Palette, Building2, Sun, Star, Save, Loader2, Check, Upload, FileText, Shield, Eye, EyeOff, Wifi, Printer, Clock, Percent, CreditCard, Receipt, MessageSquare, Phone, ChevronDown, ChevronUp, BookOpen } from 'lucide-react'
import { uploadImage } from '../lib/storage'

type TabId = 'theme' | 'org' | 'einvoice' | 'security' | 'operations' | 'invoice' | 'payments'

const DEFAULT_INVOICE: Record<string, any> = {
  show_logo: true, logo_bw: true, show_address: true, show_phone: true,
  show_tax_number: true, show_tax_id: false, show_branch: true, show_cashier: true, show_subtotal: true,
  show_discount: true, show_tax: true, show_payment_method: true, show_qr_code: false,
  footer_text: 'شكراً لزيارتكم', footer_text2: '',
}

const DEFAULT_EPAYMENT: Record<string, any> = {
  enabled: false,
  gateways: {
    paymob: { enabled: false, public_key: '', card_integration_id: '', wallet_integration_id: '', allow_card: true, allow_wallet: true, is_live: false },
  },
  link_delivery: {
    method: 'manual',
    sms: { provider: 'generic', api_url: '', api_key: '', sender_id: '', username: '', password: '' },
    whatsapp: { phone_number_id: '', access_token: '' },
  },
}

const TAB_CONFIG: { id: TabId; label: string; icon: typeof Palette; tooltip: string }[] = [
  { id: 'theme', label: 'المظهر', icon: Palette, tooltip: 'تغيير الألوان والثيم العام للتطبيق' },
  { id: 'org', label: 'المؤسسة', icon: Building2, tooltip: 'بيانات المنشأة: الاسم، العنوان، الهاتف، الضريبة' },
  { id: 'invoice', label: 'تصميم الفاتورة', icon: Receipt, tooltip: 'التحكم في شكل ومحتوى الفاتورة المطبوعة' },
  { id: 'payments', label: 'الدفع الإلكتروني', icon: CreditCard, tooltip: 'إعداد بوابة Paymob وطرق إرسال رابط الدفع' },
  { id: 'operations', label: 'التشغيل', icon: Clock, tooltip: 'أوقات العمل وإعدادات التشغيل اليومية' },
  { id: 'einvoice', label: 'الفاتورة الإلكترونية', icon: FileText, tooltip: 'ربط مع منظومة الفاتورة الإلكترونية المصرية (ETA)' },
  { id: 'security', label: 'الأمان', icon: Shield, tooltip: 'أوقات الوصول وإعدادات الطباعة والأمان' },
]

export default function SettingsPage() {
  const theme = useThemeStore()
  const { org, loading: orgLoading, update: updateOrg } = useOrganization()
  const [activeTab, setActiveTab] = useState<TabId>('theme')
  const toast = useToast()
  const [logoUploading, setLogoUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [showSecret, setShowSecret] = useState(false)
  const [testingEta, setTestingEta] = useState(false)

  const [orgForm, setOrgForm] = useState({ name: '', phone: '', email: '', address: '', tax_number: '', currency: 'ج.م', tax_rate: 0 })
  const [einvoiceForm, setEinvoiceForm] = useState({ einvoice_enabled: false, einvoice_client_id: '', einvoice_client_secret: '', einvoice_env: 'preprod', einvoice_reg_number: '' })
  const [securityForm, setSecurityForm] = useState({ access_time_start: '', access_time_end: '', receipt_footer: '', print_invoices_enabled: true })
  const [opsForm, setOpsForm] = useState({ opening_time: '', closing_time: '', last_order_cutoff_minutes: 30 })
  const [invoiceForm, setInvoiceForm] = useState<Record<string, any>>({ ...DEFAULT_INVOICE })
  const [epaymentForm, setEpaymentForm] = useState<Record<string, any>>(JSON.parse(JSON.stringify(DEFAULT_EPAYMENT)))
  const [showPaymobKey, setShowPaymobKey] = useState(false)
  const [showPaymobGuide, setShowPaymobGuide] = useState(false)
  const [showSmsConfig, setShowSmsConfig] = useState(false)
  const [showWhatsappConfig, setShowWhatsappConfig] = useState(false)
  const [savingDelivery, setSavingDelivery] = useState(false)

  const orgAny = org as any

  useEffect(() => {
    if (!org) return
    setOrgForm({ name: org.name, phone: org.phone || '', email: org.email || '', address: org.address || '', tax_number: org.tax_number || '', currency: 'ج.م', tax_rate: orgAny?.tax_rate ?? 14 })
    setOpsForm({ opening_time: orgAny?.opening_time || '', closing_time: orgAny?.closing_time || '', last_order_cutoff_minutes: orgAny?.last_order_cutoff_minutes ?? 30 })
    setEinvoiceForm({ einvoice_enabled: orgAny?.einvoice_enabled || false, einvoice_client_id: orgAny?.einvoice_client_id || '', einvoice_client_secret: orgAny?.einvoice_client_secret || '', einvoice_env: orgAny?.einvoice_env === 'production' ? 'prod' : orgAny?.einvoice_env === 'preproduction' ? 'preprod' : (orgAny?.einvoice_env || 'preprod'), einvoice_reg_number: orgAny?.einvoice_reg_number || '' })
    setSecurityForm({ access_time_start: orgAny?.access_time_start || '', access_time_end: orgAny?.access_time_end || '', receipt_footer: orgAny?.receipt_footer || '', print_invoices_enabled: orgAny?.print_invoices_enabled !== false })
    setInvoiceForm({ ...DEFAULT_INVOICE, ...(orgAny?.invoice_settings || {}) })
    // Load electronic_payment_config with deep merge
    const epConfig = orgAny?.electronic_payment_config || orgAny?.paymob_config || {}
    const merged = JSON.parse(JSON.stringify(DEFAULT_EPAYMENT))
    if (epConfig.enabled !== undefined) merged.enabled = epConfig.enabled
    if (epConfig.gateways?.paymob) Object.assign(merged.gateways.paymob, epConfig.gateways.paymob)
    if (epConfig.link_delivery) {
      if (epConfig.link_delivery.method) merged.link_delivery.method = epConfig.link_delivery.method
      if (epConfig.link_delivery.sms) Object.assign(merged.link_delivery.sms, epConfig.link_delivery.sms)
      if (epConfig.link_delivery.whatsapp) Object.assign(merged.link_delivery.whatsapp, epConfig.link_delivery.whatsapp)
    }
    setEpaymentForm(merged)
  }, [org])

  const presetOptions: { key: ThemePreset; label: string; icon: typeof Sun }[] = [
    { key: 'dark', label: 'داكن', icon: Star },
    { key: 'light', label: 'فاتح', icon: Sun },
  ]

  const handleSaveOrg = async () => { setSaving(true); await updateOrg(orgForm as any); setSaving(false); toast.success('تم حفظ بيانات المنشأة') }
  const handleSaveOps = async () => { setSaving(true); await updateOrg(opsForm as any); setSaving(false); toast.success('تم حفظ إعدادات التشغيل') }

  const handleSaveInvoice = async () => {
    setSaving(true)
    await updateOrg({ invoice_settings: invoiceForm } as any)
    setSaving(false)
    toast.success('تم حفظ إعدادات الفاتورة')
  }

  const handleSaveEpayment = async () => {
    setSaving(true)
    await updateOrg({ electronic_payment_config: epaymentForm } as any)
    setSaving(false)
    toast.success('تم حفظ إعدادات الدفع الإلكتروني')
  }

  const handleSaveDelivery = async () => {
    setSavingDelivery(true)
    await updateOrg({ electronic_payment_config: epaymentForm } as any)
    setSavingDelivery(false)
    toast.success('تم حفظ إعدادات إرسال الرابط')
  }

  const handleSaveEinvoice = async () => {
    setSaving(true)
    await updateOrg({ ...einvoiceForm, einvoice_env: einvoiceForm.einvoice_env === 'prod' ? 'production' : 'preproduction' } as any)
    setSaving(false)
    toast.success('تم حفظ إعدادات الفاتورة الإلكترونية')
  }

  const handleSaveSecurity = async () => { setSaving(true); await updateOrg({ ...securityForm } as any); setSaving(false); toast.success('تم حفظ إعدادات الأمان') }

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setLogoUploading(true)
    const orgId = org?.id || 'default'
    // Use a separate public bucket if product-images is restricted
    const r = await uploadImage({ file, bucket: 'product-images', path: `org/logo-${orgId}.jpg` })
    if (!r.error) {
      // Store the clean URL without cache-buster so it's stable for login page/sidebar
      // Use cache-buster only in state for immediate refresh, not for persistence
      const cleanUrl = r.publicUrl.split('?')[0]
      await updateOrg({ logo_url: cleanUrl, logo_storage_path: r.storagePath } as any)
      toast.success('تم تحديث الشعار')
    } else {
      // Try with a different bucket path in case of permissions issue
      toast.error(`فشل رفع الشعار — ${r.error?.message || 'تحقق من صلاحيات storage bucket في Supabase'}`)
    }
    setLogoUploading(false)
  }

  const handleTestETA = async () => {
    if (!einvoiceForm.einvoice_client_id || !einvoiceForm.einvoice_client_secret) {
      return toast.warning('أدخل Client ID و Client Secret أولاً')
    }
    setTestingEta(true)
    const env = einvoiceForm.einvoice_env === 'prod' ? 'production' : 'preproduction'
    const ok = await testETAConnection({ clientId: einvoiceForm.einvoice_client_id, clientSecret: einvoiceForm.einvoice_client_secret, env, registrationNumber: einvoiceForm.einvoice_reg_number })
    setTestingEta(false)
    if (ok) toast.success('تم الاتصال بنجاح بمنظومة الفاتورة الإلكترونية') 
    else toast.error('فشل الاتصال — تحقق من البيانات')
  }

  if (theme.isLoading || orgLoading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin" style={{ color: 'var(--primary)' }} /></div>

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <h1 className="text-xl font-black" style={{ color: 'var(--text-heading)' }}>الإعدادات</h1>

      {/* Tab bar */}
      <div className="flex items-center gap-2 flex-wrap">
        {TAB_CONFIG.map(t => {
          const Icon = t.icon
          return (
            <button key={t.id} onClick={() => setActiveTab(t.id)} title={t.tooltip} className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all" style={{ background: activeTab === t.id ? 'var(--primary)' : 'var(--bg-card)', color: activeTab === t.id ? 'var(--text-on-primary)' : 'var(--text-muted)', border: activeTab !== t.id ? '1px solid var(--border-light)' : '1px solid transparent', boxShadow: activeTab === t.id ? '0 2px 8px rgba(0,0,0,0.15)' : 'none' }}>
              <Icon className="w-4 h-4" />{t.label}
            </button>
          )
        })}
      </div>

      {/* Theme Tab */}
      {activeTab === 'theme' && (
        <div className="space-y-6">
          <div className="rounded-xl border p-5" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-light)' }}>
            <h3 className="text-sm font-bold mb-4" style={{ color: 'var(--text-heading)' }}>السمات</h3>
            <div className="grid grid-cols-3 gap-3">
              {presetOptions.map(opt => (
                <button key={opt.key} onClick={() => theme.switchPreset(opt.key)} className="relative p-4 rounded-xl border-2 text-center transition-all" style={{ borderColor: theme.activePreset === opt.key ? 'var(--primary)' : 'var(--border-light)', background: theme.activePreset === opt.key ? 'rgba(16,185,129,0.04)' : 'transparent' }}>
                  {theme.activePreset === opt.key && <div className="absolute top-2 left-2 w-5 h-5 rounded-full flex items-center justify-center" style={{ background: 'var(--primary)' }}><Check className="w-3 h-3" style={{ color: 'var(--text-on-primary)' }} /></div>}
                  <opt.icon className="w-6 h-6 mx-auto mb-2" style={{ color: theme.activePreset === opt.key ? 'var(--primary)' : 'var(--text-muted)' }} />
                  <p className="text-sm font-bold" style={{ color: 'var(--text-heading)' }}>{opt.label}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Core Colors */}
          <div className="rounded-xl border p-5" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-light)' }}>
            <h3 className="text-sm font-bold mb-4" style={{ color: 'var(--text-heading)' }}>الألوان الأساسية</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[{ key: 'primaryColor', label: 'الأساسي' }, { key: 'accentColor', label: 'التمييز' }, { key: 'dangerColor', label: 'التحذير' }, { key: 'successColor', label: 'النجاح' }].map(f => (
                <div key={f.key} className="flex items-center gap-2"><input type="color" value={(theme as any)[f.key]} onChange={(e) => theme.setTheme({ [f.key]: e.target.value })} className="w-8 h-8 rounded cursor-pointer" /><div><p className="text-xs font-bold" style={{ color: 'var(--text-heading)' }}>{f.label}</p><p className="text-[10px] font-mono" style={{ color: 'var(--text-muted)' }}>{(theme as any)[f.key]}</p></div></div>
              ))}
            </div>
          </div>

          {/* Backgrounds & Sidebar */}
          <div className="rounded-xl border p-5" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-light)' }}>
            <h3 className="text-sm font-bold mb-4" style={{ color: 'var(--text-heading)' }}>الخلفيات والشريط الجانبي</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {[
                { key: 'bgSidebar', label: 'خلفية الشريط الجانبي' },
                { key: 'bgMain', label: 'خلفية الصفحة' },
                { key: 'bgCard', label: 'خلفية البطاقات' },
                { key: 'bgInput', label: 'خلفية الحقول' },
                { key: 'textOnSidebar', label: 'نص الشريط الجانبي' },
                { key: 'borderColor', label: 'الحدود' },
              ].map(f => (
                <div key={f.key} className="flex items-center gap-2">
                  <input type="color" value={(theme as any)[f.key]} onChange={(e) => theme.setTheme({ [f.key]: e.target.value })} className="w-8 h-8 rounded cursor-pointer border" style={{ borderColor: 'var(--border-light)' }} />
                  <div>
                    <p className="text-xs font-bold" style={{ color: 'var(--text-heading)' }}>{f.label}</p>
                    <p className="text-[10px] font-mono" style={{ color: 'var(--text-muted)' }}>{(theme as any)[f.key]}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Text Colors */}
          <div className="rounded-xl border p-5" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-light)' }}>
            <h3 className="text-sm font-bold mb-4" style={{ color: 'var(--text-heading)' }}>ألوان النصوص</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { key: 'textHeading', label: 'العناوين' },
                { key: 'textMain', label: 'النص الأساسي' },
                { key: 'textMuted', label: 'النص الثانوي' },
                { key: 'textOnPrimary', label: 'نص على الأساسي' },
              ].map(f => (
                <div key={f.key} className="flex items-center gap-2">
                  <input type="color" value={(theme as any)[f.key]} onChange={(e) => theme.setTheme({ [f.key]: e.target.value })} className="w-8 h-8 rounded cursor-pointer border" style={{ borderColor: 'var(--border-light)' }} />
                  <div>
                    <p className="text-xs font-bold" style={{ color: 'var(--text-heading)' }}>{f.label}</p>
                    <p className="text-[10px] font-mono" style={{ color: 'var(--text-muted)' }}>{(theme as any)[f.key]}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Corner Radius */}
          <div className="rounded-xl border p-5" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-light)' }}>
            <div className="flex items-center justify-between mb-2"><p className="text-sm font-bold" style={{ color: 'var(--text-heading)' }}>استدارة الزوايا</p><span className="text-xs px-2 py-0.5 rounded" style={{ background: 'var(--bg-input)', color: 'var(--text-muted)' }}>{theme.cornerRadius}px</span></div>
            <input type="range" min={0} max={24} value={theme.cornerRadius} onChange={(e) => theme.setTheme({ cornerRadius: Number(e.target.value) })} className="w-full accent-[var(--primary)]" />
          </div>
        </div>
      )}

      {/* Org Tab */}
      {activeTab === 'org' && (
        <div className="rounded-xl border p-5 space-y-4" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-light)' }}>
          <h3 className="text-sm font-bold" style={{ color: 'var(--text-heading)' }}>بيانات المؤسسة</h3>
          <div className="flex items-center gap-4">
            {org?.logo_url && <img src={org.logo_url} alt="" className="w-16 h-16 rounded-xl object-cover" />}
            <label className="flex items-center gap-2 px-4 py-2 rounded-lg cursor-pointer text-sm font-bold" style={{ background: 'var(--primary)', color: 'var(--text-on-primary)' }}>{logoUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}{org?.logo_url ? 'تغيير الشعار' : 'رفع شعار'}<input type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" disabled={logoUploading} /></label>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2"><label className="block text-xs font-bold mb-1" style={{ color: 'var(--text-muted)' }}>اسم المؤسسة</label><input value={orgForm.name} onChange={e => setOrgForm({ ...orgForm, name: e.target.value })} className="w-full px-3 py-2 rounded-lg border text-sm" style={{ background: 'var(--bg-input)', borderColor: 'var(--border)', color: 'var(--text-main)' }} /></div>
            <div><label className="block text-xs font-bold mb-1" style={{ color: 'var(--text-muted)' }}>الهاتف</label><input value={orgForm.phone} onChange={e => setOrgForm({ ...orgForm, phone: e.target.value })} className="w-full px-3 py-2 rounded-lg border text-sm" dir="ltr" style={{ background: 'var(--bg-input)', borderColor: 'var(--border)', color: 'var(--text-main)' }} /></div>
            <div><label className="block text-xs font-bold mb-1" style={{ color: 'var(--text-muted)' }}>البريد الإلكتروني</label><input value={orgForm.email} onChange={e => setOrgForm({ ...orgForm, email: e.target.value })} className="w-full px-3 py-2 rounded-lg border text-sm" dir="ltr" style={{ background: 'var(--bg-input)', borderColor: 'var(--border)', color: 'var(--text-main)' }} /></div>
            <div className="col-span-2"><label className="block text-xs font-bold mb-1" style={{ color: 'var(--text-muted)' }}>العنوان</label><input value={orgForm.address} onChange={e => setOrgForm({ ...orgForm, address: e.target.value })} className="w-full px-3 py-2 rounded-lg border text-sm" style={{ background: 'var(--bg-input)', borderColor: 'var(--border)', color: 'var(--text-main)' }} /></div>
            <div><label className="block text-xs font-bold mb-1" style={{ color: 'var(--text-muted)' }}>الرقم الضريبي</label><input value={orgForm.tax_number} onChange={e => setOrgForm({ ...orgForm, tax_number: e.target.value })} className="w-full px-3 py-2 rounded-lg border text-sm" dir="ltr" style={{ background: 'var(--bg-input)', borderColor: 'var(--border)', color: 'var(--text-main)' }} /></div>
            <div>
              <label className="block text-xs font-bold mb-1" style={{ color: 'var(--text-muted)' }}>نسبة الضريبة (%)</label>
              <div className="relative">
                <input type="number" min="0" max="100" step="0.1" value={orgForm.tax_rate} onChange={e => setOrgForm({ ...orgForm, tax_rate: parseFloat(e.target.value) || 0 })} className="w-full px-3 py-2 rounded-lg border text-sm" dir="ltr" style={{ background: 'var(--bg-input)', borderColor: 'var(--border)', color: 'var(--text-main)' }} />
                <Percent className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: 'var(--text-muted)' }} />
              </div>
            </div>
          </div>
          <button onClick={handleSaveOrg} disabled={saving} className="w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2" style={{ background: 'var(--primary)', color: 'var(--text-on-primary)' }}>{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}حفظ البيانات</button>
        </div>
      )}



      {/* E-Invoice Tab */}
      {activeTab === 'einvoice' && (
        <div className="rounded-xl border p-5 space-y-4" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-light)' }}>
          <div>
            <h3 className="text-sm font-bold" style={{ color: 'var(--text-heading)' }}>الفاتورة الإلكترونية المصرية (ETA)</h3>
            <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>تكامل مع منظومة الفاتورة الإلكترونية — هيئة الضرائب المصرية</p>
          </div>
          <div className="flex items-center justify-between p-4 rounded-xl" style={{ background: 'var(--bg-input)' }}>
            <div>
              <p className="text-sm font-bold" style={{ color: 'var(--text-heading)' }}>تفعيل الفاتورة الإلكترونية</p>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>يتطلب بيانات شهادة صادرة من الهيئة</p>
            </div>
            <button onClick={() => setEinvoiceForm(f => ({ ...f, einvoice_enabled: !f.einvoice_enabled }))} className="w-12 h-6 rounded-full transition-all relative" style={{ background: einvoiceForm.einvoice_enabled ? 'var(--primary)' : 'var(--border)' }}>
              <span className="w-5 h-5 rounded-full bg-white absolute top-0.5 transition-all" style={{ left: einvoiceForm.einvoice_enabled ? '26px' : '2px' }} />
            </button>
          </div>
          {einvoiceForm.einvoice_enabled && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold mb-1" style={{ color: 'var(--text-muted)' }}>البيئة</label>
                  <select value={einvoiceForm.einvoice_env} onChange={e => setEinvoiceForm(f => ({ ...f, einvoice_env: e.target.value }))} className="w-full px-3 py-2 rounded-lg border text-sm" style={{ background: 'var(--bg-input)', borderColor: 'var(--border)', color: 'var(--text-main)' }}>
                    <option value="preprod">اختبار (Preproduction)</option>
                    <option value="prod">إنتاج (Production)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold mb-1" style={{ color: 'var(--text-muted)' }}>رقم التسجيل الضريبي</label>
                  <input value={einvoiceForm.einvoice_reg_number} onChange={e => setEinvoiceForm(f => ({ ...f, einvoice_reg_number: e.target.value }))} placeholder="EGY-xxxxxxxxx" className="w-full px-3 py-2 rounded-lg border text-sm" dir="ltr" style={{ background: 'var(--bg-input)', borderColor: 'var(--border)', color: 'var(--text-main)' }} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold mb-1" style={{ color: 'var(--text-muted)' }}>Client ID</label>
                <input value={einvoiceForm.einvoice_client_id} onChange={e => setEinvoiceForm(f => ({ ...f, einvoice_client_id: e.target.value }))} className="w-full px-3 py-2 rounded-lg border text-sm font-mono" dir="ltr" style={{ background: 'var(--bg-input)', borderColor: 'var(--border)', color: 'var(--text-main)' }} />
              </div>
              <div>
                <label className="block text-xs font-bold mb-1" style={{ color: 'var(--text-muted)' }}>Client Secret</label>
                <div className="relative">
                  <input type={showSecret ? 'text' : 'password'} value={einvoiceForm.einvoice_client_secret} onChange={e => setEinvoiceForm(f => ({ ...f, einvoice_client_secret: e.target.value }))} className="w-full px-3 py-2 rounded-lg border text-sm font-mono pl-10" dir="ltr" style={{ background: 'var(--bg-input)', borderColor: 'var(--border)', color: 'var(--text-main)' }} />
                  <button onClick={() => setShowSecret(s => !s)} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }}>{showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button>
                </div>
              </div>
              <button onClick={handleTestETA} disabled={testingEta} className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold" style={{ background: 'var(--bg-input)', color: 'var(--text-heading)', border: '1px solid var(--border)' }}>
                {testingEta ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wifi className="w-4 h-4" />}اختبار الاتصال
              </button>
            </div>
          )}
          <button onClick={handleSaveEinvoice} disabled={saving} className="w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2" style={{ background: 'var(--primary)', color: 'var(--text-on-primary)' }}>{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}حفظ الإعدادات</button>
        </div>
      )}

      {/* Operations Tab */}
      {activeTab === 'operations' && (
        <div className="space-y-4">
          {/* Opening & Closing Hours */}
          <div className="rounded-xl border p-5 space-y-4" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-light)' }}>
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5" style={{ color: 'var(--primary)' }} />
              <div>
                <h3 className="text-sm font-bold" style={{ color: 'var(--text-heading)' }}>أوقات العمل</h3>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>يتوقف النظام عن قبول الطلبات بعد وقت الإغلاق</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold mb-1" style={{ color: 'var(--text-muted)' }}>وقت الفتح</label>
                <input type="time" value={opsForm.opening_time} onChange={e => setOpsForm(f => ({ ...f, opening_time: e.target.value }))} className="w-full px-3 py-2.5 rounded-xl border text-sm" dir="ltr" style={{ background: 'var(--bg-input)', borderColor: 'var(--border)', color: 'var(--text-main)' }} />
              </div>
              <div>
                <label className="block text-xs font-bold mb-1" style={{ color: 'var(--text-muted)' }}>وقت الإغلاق</label>
                <input type="time" value={opsForm.closing_time} onChange={e => setOpsForm(f => ({ ...f, closing_time: e.target.value }))} className="w-full px-3 py-2.5 rounded-xl border text-sm" dir="ltr" style={{ background: 'var(--bg-input)', borderColor: 'var(--border)', color: 'var(--text-main)' }} />
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold mb-1" style={{ color: 'var(--text-muted)' }}>إيقاف الطلبات قبل الإغلاق بـ (دقيقة)</label>
              <input type="number" min="0" max="120" value={opsForm.last_order_cutoff_minutes} onChange={e => setOpsForm(f => ({ ...f, last_order_cutoff_minutes: parseInt(e.target.value) || 0 }))} className="w-full px-3 py-2.5 rounded-xl border text-sm" dir="ltr" style={{ background: 'var(--bg-input)', borderColor: 'var(--border)', color: 'var(--text-main)' }} />
              <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>مثال: 30 → يوقف الطلبات قبل الإغلاق بـ 30 دقيقة</p>
            </div>
          </div>

          <div className="p-4 rounded-xl border" style={{ background: 'rgba(16,185,129,0.05)', borderColor: 'var(--border-light)' }}>
            <div className="flex items-center gap-2 mb-1">
              <Printer className="w-4 h-4" style={{ color: 'var(--primary)' }} />
              <p className="text-sm font-bold" style={{ color: 'var(--text-heading)' }}>إعداد الطابعة (مخصص لكل جهاز)</p>
            </div>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>إعداد الطابعة يتم من شاشة نقطة البيع مباشرةً لأن كل جهاز له طابعة مستقلة. انتقل إلى شاشة POS ← أيقونة الطابعة في الرأس لتحديد الطابعة المفضلة لهذا الجهاز.</p>
          </div>

          <button onClick={handleSaveOps} disabled={saving} className="w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2" style={{ background: 'var(--primary)', color: 'var(--text-on-primary)' }}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}حفظ إعدادات التشغيل
          </button>
        </div>
      )}

      {/* Invoice Tab */}
      {activeTab === 'invoice' && (
        <div className="space-y-5">
          {/* Show/Hide Fields */}
          <div className="rounded-xl border p-5 space-y-3" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-light)' }}>
            <h3 className="text-sm font-bold" style={{ color: 'var(--text-heading)' }}>البيانات المطبوعة على الفاتورة</h3>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>تحكم في ما يظهر على الفاتورة المطبوعة — العملة: جنيه مصري (ج.م)</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {[
                { key: 'show_logo', label: 'الشعار', sub: 'صورة المنشأة' },
                { key: 'logo_bw', label: 'الشعار بالأبيض والأسود', sub: 'مناسب للطابعات الحرارية' },
                { key: 'show_address', label: 'العنوان' },
                { key: 'show_phone', label: 'رقم الهاتف' },
                { key: 'show_tax_number', label: 'الرقم الضريبي' },
                { key: 'show_tax_id', label: 'رقم التسجيل الضريبي (Tax ID)', sub: 'إظهار رقم مستقل عن الرقم الضريبي العام' },
                { key: 'show_branch', label: 'اسم الفرع' },
                { key: 'show_cashier', label: 'اسم الكاشير' },
                { key: 'show_subtotal', label: 'المجموع قبل الضريبة' },
                { key: 'show_discount', label: 'الخصم' },
                { key: 'show_tax', label: 'الضريبة' },
                { key: 'show_payment_method', label: 'طريقة الدفع' },
                { key: 'show_qr_code', label: 'رمز QR' },
              ].map(f => (
                <div key={f.key} className="flex items-center justify-between px-3 py-2.5 rounded-xl" style={{ background: 'var(--bg-input)' }}>
                  <div>
                    <p className="text-sm font-bold" style={{ color: 'var(--text-heading)' }}>{f.label}</p>
                    {f.sub && <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{f.sub}</p>}
                  </div>
                  <button
                    onClick={() => setInvoiceForm(prev => ({ ...prev, [f.key]: !prev[f.key] }))}
                    className="w-11 h-6 rounded-full relative flex-shrink-0 transition-all"
                    style={{ background: invoiceForm[f.key] ? 'var(--primary)' : 'var(--border)' }}
                  >
                    <span className="absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all" style={{ left: invoiceForm[f.key] ? '22px' : '2px' }} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Footer Text */}
          <div className="rounded-xl border p-5 space-y-3" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-light)' }}>
            <h3 className="text-sm font-bold" style={{ color: 'var(--text-heading)' }}>نص الفاتورة</h3>
            <div>
              <label className="block text-xs font-bold mb-1" style={{ color: 'var(--text-muted)' }}>نص الذيل (السطر الأول)</label>
              <input value={invoiceForm.footer_text} onChange={e => setInvoiceForm(f => ({ ...f, footer_text: e.target.value }))} placeholder="شكراً لزيارتكم ❤" className="w-full px-3 py-2 rounded-lg border text-sm" style={{ background: 'var(--bg-input)', borderColor: 'var(--border)', color: 'var(--text-main)' }} />
            </div>
            <div>
              <label className="block text-xs font-bold mb-1" style={{ color: 'var(--text-muted)' }}>نص الذيل (السطر الثاني)</label>
              <input value={invoiceForm.footer_text2} onChange={e => setInvoiceForm(f => ({ ...f, footer_text2: e.target.value }))} placeholder="مثال: لا يُقبل الاستبدال بعد 7 أيام" className="w-full px-3 py-2 rounded-lg border text-sm" style={{ background: 'var(--bg-input)', borderColor: 'var(--border)', color: 'var(--text-main)' }} />
            </div>
          </div>

          <button onClick={handleSaveInvoice} disabled={saving} className="w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2" style={{ background: 'var(--primary)', color: 'var(--text-on-primary)' }}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}حفظ إعدادات الفاتورة
          </button>
        </div>
      )}

      {/* Payments Tab */}
      {activeTab === 'payments' && (
        <div className="space-y-5">
          {/* Master Enable/Disable */}
          <div className="rounded-xl border p-5 space-y-4" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-light)' }}>
            <div className="flex items-center gap-2">
              <CreditCard className="w-5 h-5" style={{ color: 'var(--primary)' }} />
              <div>
                <h3 className="text-sm font-bold" style={{ color: 'var(--text-heading)' }}>الدفع الإلكتروني</h3>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>يتيح للكاشير إرسال رابط دفع إلكتروني للعميل (فيزا / محفظة)</p>
              </div>
            </div>
            <div className="flex items-center justify-between p-4 rounded-xl" style={{ background: 'var(--bg-input)' }}>
              <div>
                <p className="text-sm font-bold" style={{ color: 'var(--text-heading)' }}>تفعيل الدفع الإلكتروني</p>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>عند التفعيل سيظهر خيار "رابط" في شاشة POS</p>
              </div>
              <button onClick={() => setEpaymentForm((f: any) => ({ ...f, enabled: !f.enabled }))}
                className="w-12 h-6 rounded-full relative transition-all"
                style={{ background: epaymentForm.enabled ? 'var(--primary)' : 'var(--border)' }}>
                <span className="absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all" style={{ left: epaymentForm.enabled ? '26px' : '2px' }} />
              </button>
            </div>
          </div>

          {epaymentForm.enabled && (
            <>
              {/* Link Delivery Method */}
              <div className="rounded-xl border p-5 space-y-4" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-light)' }}>
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-5 h-5" style={{ color: 'var(--primary)' }} />
                  <div>
                    <h3 className="text-sm font-bold" style={{ color: 'var(--text-heading)' }}>طريقة إرسال رابط الدفع</h3>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>كيف يحصل العميل على رابط الدفع بعد إنشائه</p>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { v: 'manual', label: 'يدوي', sub: 'نسخ الرابط يدوياً', icon: '📋' },
                    { v: 'sms', label: 'SMS', sub: 'رسالة نصية', icon: '📱' },
                    { v: 'whatsapp', label: 'WhatsApp', sub: 'رسالة واتساب', icon: '💬' },
                  ].map(opt => (
                    <button key={opt.v} onClick={() => setEpaymentForm((f: any) => ({ ...f, link_delivery: { ...f.link_delivery, method: opt.v } }))}
                      className="p-3 rounded-xl border-2 text-center transition-all"
                      style={{ borderColor: epaymentForm.link_delivery?.method === opt.v ? 'var(--primary)' : 'var(--border-light)', background: epaymentForm.link_delivery?.method === opt.v ? 'rgba(16,185,129,0.06)' : 'var(--bg-input)' }}>
                      <p className="text-lg mb-1">{opt.icon}</p>
                      <p className="text-xs font-bold" style={{ color: epaymentForm.link_delivery?.method === opt.v ? 'var(--primary)' : 'var(--text-heading)' }}>{opt.label}</p>
                      <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{opt.sub}</p>
                    </button>
                  ))}
                </div>

                {/* SMS Config */}
                {epaymentForm.link_delivery?.method === 'sms' && (
                  <div className="space-y-3 p-4 rounded-xl border" style={{ borderColor: 'var(--border-light)', background: 'var(--bg-input)' }}>
                    <button onClick={() => setShowSmsConfig(s => !s)} className="flex items-center justify-between w-full">
                      <div className="flex items-center gap-2">
                        <Phone className="w-4 h-4" style={{ color: 'var(--primary)' }} />
                        <span className="text-sm font-bold" style={{ color: 'var(--text-heading)' }}>إعدادات مزود SMS</span>
                      </div>
                      {showSmsConfig ? <ChevronUp className="w-4 h-4" style={{ color: 'var(--text-muted)' }} /> : <ChevronDown className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />}
                    </button>
                    {showSmsConfig && (
                      <div className="space-y-3 pt-2">
                        <div>
                          <label className="block text-xs font-bold mb-1" style={{ color: 'var(--text-muted)' }}>مزود الخدمة</label>
                          <select value={epaymentForm.link_delivery?.sms?.provider || 'generic'}
                            onChange={e => setEpaymentForm((f: any) => ({ ...f, link_delivery: { ...f.link_delivery, sms: { ...f.link_delivery.sms, provider: e.target.value } } }))}
                            className="w-full px-3 py-2 rounded-lg border text-sm" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)', color: 'var(--text-main)' }}>
                            <option value="generic">Generic HTTP (أي مزود REST)</option>
                            <option value="smsmisr">SMS Misr (مصر)</option>
                            <option value="vodafone">Vodafone Business SMS</option>
                          </select>
                        </div>
                        {(epaymentForm.link_delivery?.sms?.provider === 'smsmisr') && (
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-xs font-bold mb-1" style={{ color: 'var(--text-muted)' }}>Username</label>
                              <input value={epaymentForm.link_delivery?.sms?.username || ''} onChange={e => setEpaymentForm((f: any) => ({ ...f, link_delivery: { ...f.link_delivery, sms: { ...f.link_delivery.sms, username: e.target.value } } }))}
                                className="w-full px-3 py-2 rounded-lg border text-sm" dir="ltr" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)', color: 'var(--text-main)' }} />
                            </div>
                            <div>
                              <label className="block text-xs font-bold mb-1" style={{ color: 'var(--text-muted)' }}>Password</label>
                              <input type="password" value={epaymentForm.link_delivery?.sms?.password || ''} onChange={e => setEpaymentForm((f: any) => ({ ...f, link_delivery: { ...f.link_delivery, sms: { ...f.link_delivery.sms, password: e.target.value } } }))}
                                className="w-full px-3 py-2 rounded-lg border text-sm" dir="ltr" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)', color: 'var(--text-main)' }} />
                            </div>
                          </div>
                        )}
                        {(epaymentForm.link_delivery?.sms?.provider === 'generic' || epaymentForm.link_delivery?.sms?.provider === 'vodafone') && (
                          <div>
                            <label className="block text-xs font-bold mb-1" style={{ color: 'var(--text-muted)' }}>API URL</label>
                            <input value={epaymentForm.link_delivery?.sms?.api_url || ''} onChange={e => setEpaymentForm((f: any) => ({ ...f, link_delivery: { ...f.link_delivery, sms: { ...f.link_delivery.sms, api_url: e.target.value } } }))}
                              placeholder="https://api.sms-provider.com/send" className="w-full px-3 py-2 rounded-lg border text-sm font-mono" dir="ltr"
                              style={{ background: 'var(--bg-card)', borderColor: 'var(--border)', color: 'var(--text-main)' }} />
                          </div>
                        )}
                        <div>
                          <label className="block text-xs font-bold mb-1" style={{ color: 'var(--text-muted)' }}>
                            {epaymentForm.link_delivery?.sms?.provider === 'smsmisr' ? 'SMS Misr API URL' : 'API Key / Token'}
                          </label>
                          <input value={epaymentForm.link_delivery?.sms?.api_key || ''} onChange={e => setEpaymentForm((f: any) => ({ ...f, link_delivery: { ...f.link_delivery, sms: { ...f.link_delivery.sms, api_key: e.target.value } } }))}
                            placeholder={epaymentForm.link_delivery?.sms?.provider === 'smsmisr' ? 'https://smsmisr.com/api/SMS' : 'sk-...'}
                            className="w-full px-3 py-2 rounded-lg border text-sm font-mono" dir="ltr"
                            style={{ background: 'var(--bg-card)', borderColor: 'var(--border)', color: 'var(--text-main)' }} />
                        </div>
                        <div>
                          <label className="block text-xs font-bold mb-1" style={{ color: 'var(--text-muted)' }}>Sender ID / اسم المُرسل</label>
                          <input value={epaymentForm.link_delivery?.sms?.sender_id || ''} onChange={e => setEpaymentForm((f: any) => ({ ...f, link_delivery: { ...f.link_delivery, sms: { ...f.link_delivery.sms, sender_id: e.target.value } } }))}
                            placeholder="Notify" className="w-full px-3 py-2 rounded-lg border text-sm" dir="ltr"
                            style={{ background: 'var(--bg-card)', borderColor: 'var(--border)', color: 'var(--text-main)' }} />
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* WhatsApp Config */}
                {epaymentForm.link_delivery?.method === 'whatsapp' && (
                  <div className="space-y-3 p-4 rounded-xl border" style={{ borderColor: 'var(--border-light)', background: 'var(--bg-input)' }}>
                    <button onClick={() => setShowWhatsappConfig(s => !s)} className="flex items-center justify-between w-full">
                      <div className="flex items-center gap-2">
                        <MessageSquare className="w-4 h-4" style={{ color: '#25D366' }} />
                        <span className="text-sm font-bold" style={{ color: 'var(--text-heading)' }}>إعدادات WhatsApp Business API</span>
                      </div>
                      {showWhatsappConfig ? <ChevronUp className="w-4 h-4" style={{ color: 'var(--text-muted)' }} /> : <ChevronDown className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />}
                    </button>
                    {showWhatsappConfig && (
                      <div className="space-y-3 pt-2">
                        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>أدخل بيانات WhatsApp Business Cloud API من Meta Developer Dashboard</p>
                        <div>
                          <label className="block text-xs font-bold mb-1" style={{ color: 'var(--text-muted)' }}>Phone Number ID</label>
                          <input value={epaymentForm.link_delivery?.whatsapp?.phone_number_id || ''} onChange={e => setEpaymentForm((f: any) => ({ ...f, link_delivery: { ...f.link_delivery, whatsapp: { ...f.link_delivery.whatsapp, phone_number_id: e.target.value } } }))}
                            placeholder="1234567890" className="w-full px-3 py-2 rounded-lg border text-sm font-mono" dir="ltr"
                            style={{ background: 'var(--bg-card)', borderColor: 'var(--border)', color: 'var(--text-main)' }} />
                        </div>
                        <div>
                          <label className="block text-xs font-bold mb-1" style={{ color: 'var(--text-muted)' }}>Access Token</label>
                          <div className="relative">
                            <input type={showWhatsappConfig ? 'text' : 'password'} value={epaymentForm.link_delivery?.whatsapp?.access_token || ''} onChange={e => setEpaymentForm((f: any) => ({ ...f, link_delivery: { ...f.link_delivery, whatsapp: { ...f.link_delivery.whatsapp, access_token: e.target.value } } }))}
                              placeholder="EAAxxxxxxx..." className="w-full px-3 py-2 rounded-lg border text-sm font-mono" dir="ltr"
                              style={{ background: 'var(--bg-card)', borderColor: 'var(--border)', color: 'var(--text-main)' }} />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Payment Gateways */}
              <div className="rounded-xl border p-5 space-y-4" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-light)' }}>
                <div>
                  <h3 className="text-sm font-bold" style={{ color: 'var(--text-heading)' }}>بوابات الدفع</h3>
                  <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>اختر بوابة الدفع وأدخل البيانات المطلوبة</p>
                </div>

                {/* Paymob Gateway Card */}
                <div className="rounded-xl border overflow-hidden" style={{ borderColor: epaymentForm.gateways?.paymob?.enabled ? 'var(--primary)' : 'var(--border-light)' }}>
                  <div className="flex items-center justify-between p-4" style={{ background: epaymentForm.gateways?.paymob?.enabled ? 'rgba(16,185,129,0.04)' : 'var(--bg-input)' }}>
                    <div className="flex items-center gap-3">
                      <img src="/paymob.svg" alt="Paymob" className="w-10 h-10 rounded-xl object-contain" style={{ background: '#fff', padding: '2px' }} />
                      <div>
                        <p className="text-sm font-bold" style={{ color: 'var(--text-heading)' }}>Paymob</p>
                        <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>بطاقات ائتمان ومحافظ إلكترونية</p>
                      </div>
                    </div>
                    <button onClick={() => setEpaymentForm((f: any) => ({ ...f, gateways: { ...f.gateways, paymob: { ...f.gateways.paymob, enabled: !f.gateways.paymob.enabled } } }))}
                      className="w-12 h-6 rounded-full relative transition-all"
                      style={{ background: epaymentForm.gateways?.paymob?.enabled ? 'var(--primary)' : 'var(--border)' }}>
                      <span className="absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all" style={{ left: epaymentForm.gateways?.paymob?.enabled ? '26px' : '2px' }} />
                    </button>
                  </div>

                  {epaymentForm.gateways?.paymob?.enabled && (
                    <div className="p-4 space-y-4 border-t" style={{ borderColor: 'var(--border-light)' }}>
                      {/* API Key */}
                      <div>
                        <label className="block text-xs font-bold mb-1" style={{ color: 'var(--text-muted)' }}>🔑 API Key</label>
                        <div className="relative">
                          <input type={showPaymobKey ? 'text' : 'password'} value={epaymentForm.gateways?.paymob?.public_key || ''} onChange={e => setEpaymentForm((f: any) => ({ ...f, gateways: { ...f.gateways, paymob: { ...f.gateways.paymob, public_key: e.target.value } } }))}
                            placeholder="ZXlKaGJHY2lPaUpJVXpVeE1pSXNJblI1Y..." className="w-full px-3 py-2 rounded-lg border text-sm font-mono pl-10" dir="ltr"
                            style={{ background: 'var(--bg-input)', borderColor: 'var(--border)', color: 'var(--text-main)' }} />
                          <button onClick={() => setShowPaymobKey(s => !s)} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }}>
                            {showPaymobKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                        <p className="text-[11px] mt-1" style={{ color: 'var(--text-muted)' }}>من: <a href="https://dashboard.paymob.com/settings/account/integrations" target="_blank" rel="noopener noreferrer" style={{textDecoration: 'underline', color: 'var(--primary)'}}>Paymob Dashboard → Settings → API Keys</a></p>
                      </div>

                      {/* Card / Wallet Integration IDs — shown based on toggles */}
                      {epaymentForm.gateways?.paymob?.allow_card && (
                        <div>
                          <label className="block text-xs font-bold mb-1" style={{ color: 'var(--text-muted)' }}>💳 Card Integration ID</label>
                          <input value={epaymentForm.gateways?.paymob?.card_integration_id || ''} onChange={e => setEpaymentForm((f: any) => ({ ...f, gateways: { ...f.gateways, paymob: { ...f.gateways.paymob, card_integration_id: e.target.value } } }))}
                            placeholder="مثال: 3154260" className="w-full px-3 py-2 rounded-lg border text-sm font-mono" dir="ltr"
                            style={{ background: 'var(--bg-input)', borderColor: 'var(--border)', color: 'var(--text-main)' }} />
                          <p className="text-[11px] mt-1" style={{ color: 'var(--text-muted)' }}>من Developers → Payment Integrations → Online Card → Integration ID</p>
                        </div>
                      )}
                      {epaymentForm.gateways?.paymob?.allow_wallet && (
                        <div>
                          <label className="block text-xs font-bold mb-1" style={{ color: 'var(--text-muted)' }}>📱 Wallet Integration ID</label>
                          <input value={epaymentForm.gateways?.paymob?.wallet_integration_id || ''} onChange={e => setEpaymentForm((f: any) => ({ ...f, gateways: { ...f.gateways, paymob: { ...f.gateways.paymob, wallet_integration_id: e.target.value } } }))}
                            placeholder="مثال: 3187445" className="w-full px-3 py-2 rounded-lg border text-sm font-mono" dir="ltr"
                            style={{ background: 'var(--bg-input)', borderColor: 'var(--border)', color: 'var(--text-main)' }} />
                          <p className="text-[11px] mt-1" style={{ color: 'var(--text-muted)' }}>من Developers → Payment Integrations → Mobile Wallet → Integration ID</p>
                        </div>
                      )}

                      {/* Allow Card / Wallet toggles */}
                      <div className="grid grid-cols-2 gap-3">
                        <div className="flex items-center justify-between p-3 rounded-xl" style={{ background: 'var(--bg-input)' }}>
                          <div>
                            <p className="text-xs font-bold" style={{ color: 'var(--text-heading)' }}>بطاقات ائتمان 💳</p>
                            <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Visa / Mastercard / Meeza</p>
                          </div>
                          <button onClick={() => setEpaymentForm((f: any) => ({ ...f, gateways: { ...f.gateways, paymob: { ...f.gateways.paymob, allow_card: !f.gateways.paymob.allow_card } } }))}
                            className="w-10 h-5 rounded-full relative transition-all"
                            style={{ background: epaymentForm.gateways?.paymob?.allow_card ? 'var(--primary)' : 'var(--border)' }}>
                            <span className="absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all" style={{ left: epaymentForm.gateways?.paymob?.allow_card ? '22px' : '2px' }} />
                          </button>
                        </div>
                        <div className="flex items-center justify-between p-3 rounded-xl" style={{ background: 'var(--bg-input)' }}>
                          <div>
                            <p className="text-xs font-bold" style={{ color: 'var(--text-heading)' }}>محفظة إلكترونية 📱</p>
                            <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>فودافون كاش / اتصالات / Orange Cash / WePay</p>
                          </div>
                          <button onClick={() => setEpaymentForm((f: any) => ({ ...f, gateways: { ...f.gateways, paymob: { ...f.gateways.paymob, allow_wallet: !f.gateways.paymob.allow_wallet } } }))}
                            className="w-10 h-5 rounded-full relative transition-all"
                            style={{ background: epaymentForm.gateways?.paymob?.allow_wallet ? 'var(--primary)' : 'var(--border)' }}>
                            <span className="absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all" style={{ left: epaymentForm.gateways?.paymob?.allow_wallet ? '22px' : '2px' }} />
                          </button>
                        </div>
                      </div>

                      {/* is_live Toggle */}
                      <div className="flex items-center justify-between p-3 rounded-xl border" style={{ background: epaymentForm.gateways?.paymob?.is_live ? 'rgba(16,185,129,0.06)' : 'rgba(245,158,11,0.06)', borderColor: epaymentForm.gateways?.paymob?.is_live ? 'var(--success)' : '#f59e0b' }}>
                        <div>
                          <p className="text-xs font-bold" style={{ color: 'var(--text-heading)' }}>
                            {epaymentForm.gateways?.paymob?.is_live ? '🟢 وضع الإنتاج (Live)' : '🟡 وضع الاختبار (Test)'}
                          </p>
                          <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                            {epaymentForm.gateways?.paymob?.is_live ? 'مدفوعات حقيقية — تأكد أن حسابك معتمد' : 'بطاقات تجريبية فقط — لا يتم خصم رصيد'}
                          </p>
                        </div>
                        <button onClick={() => setEpaymentForm((f: any) => ({ ...f, gateways: { ...f.gateways, paymob: { ...f.gateways.paymob, is_live: !f.gateways.paymob.is_live } } }))}
                          className="w-10 h-5 rounded-full relative transition-all"
                          style={{ background: epaymentForm.gateways?.paymob?.is_live ? 'var(--success)' : '#f59e0b' }}>
                          <span className="absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all" style={{ left: epaymentForm.gateways?.paymob?.is_live ? '22px' : '2px' }} />
                        </button>
                      </div>

                      {/* Paymob Setup Guide */}
                      <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--border-light)' }}>
                        <button onClick={() => setShowPaymobGuide(s => !s)} className="flex items-center justify-between w-full p-3" style={{ background: 'rgba(37,99,235,0.04)' }}>
                          <div className="flex items-center gap-2">
                            <BookOpen className="w-4 h-4" style={{ color: '#2563eb' }} />
                            <span className="text-xs font-bold" style={{ color: '#2563eb' }}>دليل إعداد Paymob — خطوة بخطوة</span>
                          </div>
                          {showPaymobGuide ? <ChevronUp className="w-4 h-4" style={{ color: 'var(--text-muted)' }} /> : <ChevronDown className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />}
                        </button>
                        {showPaymobGuide && (
                          <div className="p-4 space-y-3 text-xs" style={{ color: 'var(--text-muted)' }}>
                            <div className="space-y-2">
                              <p className="font-bold" style={{ color: 'var(--text-heading)' }}>1. إنشاء حساب Paymob</p>
                              <p>• سجّل على <a href="https://accept.paymob.com" target="_blank" rel="noopener noreferrer" className="underline" style={{ color: 'var(--primary)' }}>accept.paymob.com</a> وأكمل التحقق من الهوية والبيانات التجارية</p>
                            </div>
                            <div className="space-y-2">
                              <p className="font-bold" style={{ color: 'var(--text-heading)' }}>2. الحصول على API Key</p>
                              <p>• من لوحة التحكم: <a href="https://dashboard.paymob.com/settings/account/integrations" target="_blank" rel="noopener noreferrer" className="underline" style={{ color: 'var(--primary)' }}>Settings → Account → API Keys</a></p>
                              <p>• انسخ الـ <strong>API Key</strong> (يبدأ بـ ZXlK...) والصقه في حقل API Key أعلاه</p>
                            </div>
                            <div className="space-y-2">
                              <p className="font-bold" style={{ color: 'var(--text-heading)' }}>3. إنشاء Integration IDs</p>
                              <p>• من: <a href="https://dashboard.paymob.com/developers/payment-integrations" target="_blank" rel="noopener noreferrer" className="underline" style={{ color: 'var(--primary)' }}>Developers → Payment Integrations</a></p>
                              <p>• لبطاقات الائتمان: أنشئ <strong>Online Card</strong> → انسخ الـ Integration ID في حقل Card Integration ID</p>
                              <p>• للمحافظ: أنشئ <strong>Mobile Wallet</strong> → انسخ الـ Integration ID في حقل Wallet Integration ID</p>
                            </div>
                            <div className="space-y-2">
                              <p className="font-bold" style={{ color: 'var(--text-heading)' }}>4. إعداد Webhook (مطلوب لتأكيد الدفع)</p>
                              <p>• من: <a href="https://dashboard.paymob.com/settings/webhooks-and-redirects" target="_blank" rel="noopener noreferrer" className="underline" style={{ color: 'var(--primary)' }}>Settings → Webhooks and Redirects</a></p>
                              <p>• في <strong>Transaction Processed Callback</strong> و <strong>Transaction Response Callback</strong> الصق:</p>
                              <p className="font-mono text-[11px] p-2 rounded-lg break-all select-all cursor-pointer" dir="ltr" style={{ background: 'var(--bg-input)', border: '1px solid var(--border)' }}>
                                https://qdkwkmezlitqjxrapuip.supabase.co/functions/v1/paymob-webhook
                              </p>
                              <p className="text-[10px]" style={{ color: '#f59e0b' }}>⚠️ بدون هذا الرابط لن يُحدَّث حالة الدفع تلقائياً</p>
                            </div>
                            <div className="space-y-2">
                              <p className="font-bold" style={{ color: 'var(--text-heading)' }}>5. وضع الإنتاج</p>
                              <p>• بعد الاختبار، فعّل <strong>وضع الإنتاج (Live)</strong> من الزر أعلاه ومن: <a href="https://dashboard.paymob.com" target="_blank" rel="noopener noreferrer" className="underline" style={{ color: 'var(--primary)' }}>Paymob Dashboard</a></p>
                            </div>
                            <div className="p-3 rounded-lg" style={{ background: 'rgba(37,99,235,0.06)' }}>
                              <p className="font-bold mb-1" style={{ color: 'var(--text-heading)' }}>📖 توثيق Paymob</p>
                              <a href="https://developers.paymob.com/paymob-docs/developers/quicklink-apis/overview" target="_blank" rel="noopener noreferrer" className="text-[11px] underline block" dir="ltr" style={{ color: 'var(--primary)' }}>developers.paymob.com → QuickLink APIs</a>
                              <a href="https://developers.paymob.com/paymob-docs/developers/payment-integrations" target="_blank" rel="noopener noreferrer" className="text-[11px] underline block mt-1" dir="ltr" style={{ color: 'var(--primary)' }}>developers.paymob.com → Payment Integrations</a>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

              </div>
            </>
          )}

          {/* Dedicated Delivery Save */}
          {epaymentForm.link_delivery?.method && epaymentForm.link_delivery.method !== 'manual' && (
            <button onClick={handleSaveDelivery} disabled={savingDelivery} className="w-full py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2" style={{ background: 'rgba(37,99,235,0.1)', color: 'var(--primary)', border: '1px solid rgba(37,99,235,0.25)' }}>
              {savingDelivery ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}حفظ إعدادات الإرسال
            </button>
          )}

          <button onClick={handleSaveEpayment} disabled={saving} className="w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2" style={{ background: 'var(--primary)', color: 'var(--text-on-primary)' }}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}حفظ إعدادات الدفع
          </button>
        </div>
      )}

      {/* Security Tab */}
      {activeTab === 'security' && (
        <div className="rounded-xl border p-5 space-y-4" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-light)' }}>
          <div>
            <h3 className="text-sm font-bold" style={{ color: 'var(--text-heading)' }}>إعدادات الأمان</h3>
            <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>تقييد الوصول وتخصيص الإيصالات</p>
          </div>
          <div className="space-y-4">
            <div className="p-4 rounded-xl space-y-3" style={{ background: 'var(--bg-input)' }}>
              <p className="text-sm font-bold" style={{ color: 'var(--text-heading)' }}>نافذة وقت الدخول المسموح</p>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>اتركها فارغة للسماح بالوصول في أي وقت</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold mb-1" style={{ color: 'var(--text-muted)' }}>من الساعة</label>
                  <input type="time" value={securityForm.access_time_start} onChange={e => setSecurityForm(f => ({ ...f, access_time_start: e.target.value }))} className="w-full px-3 py-2 rounded-lg border text-sm" dir="ltr" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)', color: 'var(--text-main)' }} />
                </div>
                <div>
                  <label className="block text-xs font-bold mb-1" style={{ color: 'var(--text-muted)' }}>حتى الساعة</label>
                  <input type="time" value={securityForm.access_time_end} onChange={e => setSecurityForm(f => ({ ...f, access_time_end: e.target.value }))} className="w-full px-3 py-2 rounded-lg border text-sm" dir="ltr" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)', color: 'var(--text-main)' }} />
                </div>
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold mb-1" style={{ color: 'var(--text-muted)' }}>نص ذيل الإيصال</label>
              <textarea value={securityForm.receipt_footer} onChange={e => setSecurityForm(f => ({ ...f, receipt_footer: e.target.value }))} rows={3} placeholder="مثال: شكراً لتسوقكم معنا · لا يُقبل الاستبدال بعد 7 أيام" className="w-full px-3 py-2.5 rounded-xl border text-sm resize-none" style={{ background: 'var(--bg-input)', borderColor: 'var(--border)', color: 'var(--text-main)' }} />
            </div>
            <div className="flex items-center justify-between py-3 px-4 rounded-xl border" style={{ borderColor: 'var(--border-light)', background: 'var(--bg-input)' }}>
              <div>
                <p className="text-sm font-bold" style={{ color: 'var(--text-heading)' }}>طباعة الفاتورة تلقائياً</p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>طباعة إيصال عند إتمام كل عملية بيع</p>
              </div>
              <button
                onClick={() => setSecurityForm(f => ({ ...f, print_invoices_enabled: !f.print_invoices_enabled }))}
                className="w-12 h-6 rounded-full transition-all flex-shrink-0 relative"
                style={{ background: securityForm.print_invoices_enabled ? 'var(--primary)' : 'var(--border)' }}
              >
                <span className="absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all" style={{ left: securityForm.print_invoices_enabled ? '26px' : '2px' }} />
              </button>
            </div>
          </div>
          <button onClick={handleSaveSecurity} disabled={saving} className="w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2" style={{ background: 'var(--primary)', color: 'var(--text-on-primary)' }}>{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}حفظ إعدادات الأمان</button>
        </div>
      )}
    </div>
  )
}

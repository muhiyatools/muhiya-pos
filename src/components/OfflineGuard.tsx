import { useState, useEffect } from 'react'
import { WifiOff } from 'lucide-react'

/** Shows an offline banner for non-POS pages when internet is down */
export default function OfflineGuard({ children }: { children: React.ReactNode }) {
  const [isOnline, setIsOnline] = useState(navigator.onLine)

  useEffect(() => {
    const onOnline = () => setIsOnline(true)
    const onOffline = () => setIsOnline(false)
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    return () => { window.removeEventListener('online', onOnline); window.removeEventListener('offline', onOffline) }
  }, [])

  if (!isOnline) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center px-4">
        <WifiOff className="w-12 h-12 mb-4" style={{ color: 'var(--text-muted)', opacity: 0.4 }} />
        <h3 className="text-lg font-bold mb-2" style={{ color: 'var(--text-heading)' }}>لا يوجد اتصال بالإنترنت</h3>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          هذه الصفحة تتطلب اتصالاً بالإنترنت. يمكنك استخدام نقطة البيع في الوضع غير المتصل.
        </p>
      </div>
    )
  }

  return <>{children}</>
}

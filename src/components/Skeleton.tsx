/**
 * Loading skeleton components for better UX
 */

interface SkeletonProps {
  className?: string
  style?: React.CSSProperties
  count?: number
}

export function SkeletonCard({ className, style }: SkeletonProps) {
  return (
    <div 
      className={`animate-pulse rounded-2xl ${className || ''}`} 
      style={{ background: 'var(--bg-card, #fff)', ...style }}
    >
      <div className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <div className="h-4 w-24 rounded" style={{ background: 'var(--border, #e2e8f0)' }} />
            <div className="h-8 w-32 rounded mt-2" style={{ background: 'var(--border, #e2e8f0)' }} />
          </div>
          <div className="w-11 h-11 rounded-xl" style={{ background: 'var(--border, #e2e8f0)' }} />
        </div>
      </div>
    </div>
  )
}

export function SkeletonTable({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 p-4 rounded-xl animate-pulse" style={{ background: 'var(--bg-card, #fff)' }}>
          <div className="w-10 h-10 rounded-lg" style={{ background: 'var(--border, #e2e8f0)' }} />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-3/4 rounded" style={{ background: 'var(--border, #e2e8f0)' }} />
            <div className="h-3 w-1/2 rounded" style={{ background: 'var(--border, #e2e8f0)' }} />
          </div>
          <div className="h-6 w-20 rounded-md" style={{ background: 'var(--border, #e2e8f0)' }} />
        </div>
      ))}
    </div>
  )
}

export function SkeletonGrid({ count = 12, className }: SkeletonProps) {
  return (
    <div className={`grid grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 ${className || ''}`}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex flex-col items-center p-4 rounded-2xl animate-pulse" style={{ background: 'var(--bg-card, #fff)', border: '1px solid var(--border-light, #f1f5f9)' }}>
          <div className="w-12 h-12 rounded-full mb-2" style={{ background: 'var(--border, #e2e8f0)' }} />
          <div className="h-3 w-3/4 rounded" style={{ background: 'var(--border, #e2e8f0)' }} />
          <div className="h-4 w-1/2 rounded mt-2" style={{ background: 'var(--border, #e2e8f0)' }} />
        </div>
      ))}
    </div>
  )
}

export function SkeletonText({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="h-4 rounded animate-pulse" style={{ background: 'var(--border, #e2e8f0)', width: `${100 - (i * 15)}%` }} />
      ))}
    </div>
  )
}

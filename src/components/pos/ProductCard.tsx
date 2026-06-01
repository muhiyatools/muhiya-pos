import { memo } from 'react'
import { Image as ImageIcon } from 'lucide-react'
import type { OfflineProduct } from '../../lib/offlineDb'
import { formatEGP } from '../../lib/utils'

interface ProductCardProps {
  product: OfflineProduct
  branchQty: number
  onClick: (product: OfflineProduct) => void
}

export const ProductCard = memo(function ProductCard({ product, branchQty, onClick }: ProductCardProps) {
  const outOfStock = !!product.track_stock && branchQty <= 0
  const lowStock = !!product.track_stock && !outOfStock && !!product.low_stock_threshold && branchQty <= product.low_stock_threshold

  return (
    <button
      onClick={() => !outOfStock && onClick(product)}
      className="relative flex flex-col items-center p-3 lg:p-4 rounded-2xl border transition-all active:scale-95 hover:border-[var(--primary)]/30"
      style={{
        background: 'var(--bg-card)',
        borderColor: 'var(--border-light)',
        opacity: outOfStock ? 0.5 : 1,
        cursor: outOfStock ? 'not-allowed' : 'pointer',
      }}
    >
      {product.primary_image_url ? (
        <img src={product.primary_image_url} alt="" className="w-10 h-10 lg:w-12 lg:h-12 rounded-lg object-cover mb-1.5" />
      ) : (
        <div className="w-10 h-10 lg:w-12 lg:h-12 rounded-lg flex items-center justify-center mb-1.5" style={{ background: 'var(--bg-input)' }}>
          <ImageIcon className="w-5 h-5 lg:w-6 lg:h-6" style={{ color: 'var(--text-muted)' }} />
        </div>
      )}
      <p className="text-[11px] lg:text-xs font-bold text-center leading-tight" style={{ color: 'var(--text-heading)' }}>{product.name}</p>
      <p className="text-[11px] lg:text-xs font-bold mt-0.5" style={{ color: 'var(--primary)' }}>{formatEGP(product.selling_price)}</p>
      <p className="text-[9px] lg:text-[10px] mt-0.5" style={{ color: outOfStock ? '#ef4444' : 'var(--text-muted)' }}>المخزون: {branchQty}</p>
      {outOfStock && (
        <span className="absolute top-1 left-1 text-[8px] px-1 py-0.5 rounded font-bold" style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444' }}>نفذ</span>
      )}
      {lowStock && (
        <span className="absolute top-1 left-1 text-[8px] px-1 py-0.5 rounded font-bold" style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444' }}>مخزون منخفض</span>
      )}
    </button>
  )
})

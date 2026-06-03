'use client'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface Column<T> {
  key: string
  header: string
  render?: (row: T) => React.ReactNode
  className?: string
}

interface Props<T> {
  columns: Column<T>[]
  data: T[]
  keyFn: (row: T) => string
  page?: number
  totalPages?: number
  onPage?: (p: number) => void
  emptyMessage?: string
  caption?: string
}

export default function DataTable<T>({
  columns, data, keyFn, page, totalPages, onPage, emptyMessage = 'No data found.', caption
}: Props<T>) {
  return (
    <div>
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-sm" aria-label={caption}>
          {caption && <caption className="sr-only">{caption}</caption>}
          <thead>
            <tr style={{ background: '#141420' }}>
              {columns.map(col => (
                <th key={col.key}
                  className={`px-4 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-text-disabled ${col.className ?? ''}`}>
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {data.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-10 text-center text-sm text-text-muted">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              data.map(row => (
                <tr key={keyFn(row)} className="hoverable transition-colors">
                  {columns.map(col => (
                    <td key={col.key} className={`px-4 py-3 text-text-secondary ${col.className ?? ''}`}>
                      {col.render ? col.render(row) : String((row as Record<string, unknown>)[col.key] ?? '')}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {totalPages && totalPages > 1 && onPage && page !== undefined && (
        <div className="flex items-center justify-between mt-4">
          <span className="text-xs text-text-muted">Page {page} of {totalPages}</span>
          <div className="flex items-center gap-2">
            <button onClick={() => onPage(page - 1)} disabled={page <= 1}
              aria-label="Previous page"
              className="p-2 rounded-lg border border-border text-text-muted hover:text-text-primary disabled:opacity-30 transition-colors">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button onClick={() => onPage(page + 1)} disabled={page >= totalPages}
              aria-label="Next page"
              className="p-2 rounded-lg border border-border text-text-muted hover:text-text-primary disabled:opacity-30 transition-colors">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

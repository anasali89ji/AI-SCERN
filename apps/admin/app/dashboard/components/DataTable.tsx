interface Column<T> { key: string; header: string; render?: (row: T) => React.ReactNode }

interface DataTableProps<T> {
  columns: Column<T>[]; data: T[]; keyFn: (row: T) => string
  page?: number; totalPages?: number; onPage?: (p: number) => void
  caption?: string; emptyMessage?: string
}

export default function DataTable<T>({ columns, data, keyFn, page, totalPages, onPage, caption, emptyMessage }: DataTableProps<T>) {
  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-left">
          {caption && <caption className="sr-only">{caption}</caption>}
          <thead>
            <tr className="border-b border-border">
              {columns.map(col => (
                <th key={col.key} className="px-4 py-3 text-[10px] font-bold uppercase text-text-disabled tracking-wider">{col.header}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.length === 0 ? (
              <tr><td colSpan={columns.length} className="px-4 py-8 text-center text-sm text-text-muted">{emptyMessage || 'No data'}</td></tr>
            ) : (
              data.map(row => (
                <tr key={keyFn(row)} className="border-b border-border/50 hover:bg-surface/30 transition-colors">
                  {columns.map(col => (
                    <td key={col.key} className="px-4 py-3">
                      {col.render ? col.render(row) : (row as any)[col.key]}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {totalPages && totalPages > 1 && onPage && (
        <div className="flex items-center justify-between">
          <p className="text-[10px] text-text-muted">Page {page} of {totalPages}</p>
          <div className="flex items-center gap-1">
            <button onClick={() => onPage(Math.max(1, (page || 1) - 1))} disabled={(page || 1) <= 1}
              className="px-3 py-1.5 rounded-lg text-xs bg-surface border border-border text-text-muted hover:text-text-primary disabled:opacity-30">Prev</button>
            <button onClick={() => onPage(Math.min(totalPages, (page || 1) + 1))} disabled={(page || 1) >= totalPages}
              className="px-3 py-1.5 rounded-lg text-xs bg-surface border border-border text-text-muted hover:text-text-primary disabled:opacity-30">Next</button>
          </div>
        </div>
      )}
    </div>
  )
}

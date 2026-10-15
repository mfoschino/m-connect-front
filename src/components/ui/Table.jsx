const Table = ({ children, className = '' }) => {
  return (
    <div className={`table-shell ${className}`}>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-sm text-slate-700">
          {children}
        </table>
      </div>
    </div>
  )
}

export default Table

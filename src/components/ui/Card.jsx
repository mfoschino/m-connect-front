const Card = ({ title, description, actions, className = '', children }) => {
  return (
    <section className={`card ${className}`}>
      {(title || description || actions) ? (
        <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
          <div className="space-y-1">
            {title ? <h2 className="text-lg font-semibold text-slate-900">{title}</h2> : null}
            {description ? <p className="text-sm text-slate-500">{description}</p> : null}
          </div>
          {actions ? <div className="flex flex-wrap items-center gap-3">{actions}</div> : null}
        </div>
      ) : null}
      <div>{children}</div>
    </section>
  )
}

export default Card

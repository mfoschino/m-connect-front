const ProfileHeader = ({ avatarUrl, name, email }) => {
  const displayName = name || email?.split('@')[0] || 'Usuario'
  const initials = displayName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('')

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <div className="inline-flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-slate-100 text-2xl font-semibold text-slate-700 ring-1 ring-slate-200">
            {avatarUrl ? (
              <img src={avatarUrl} alt="Profile avatar" className="h-full w-full object-cover" />
            ) : (
              <span>{initials || 'U'}</span>
            )}
          </div>
          <div>
            <p className="text-lg font-semibold text-slate-900">{displayName}</p>
            <p className="text-sm text-slate-500">{email || 'Sin correo registrado'}</p>
          </div>
        </div>
        <div className="rounded-3xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
          Ajusta tus datos de acceso y visualización de perfil en un solo lugar.
        </div>
      </div>
    </section>
  )
}

export default ProfileHeader

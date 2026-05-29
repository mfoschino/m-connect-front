import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

const ProfileMenu = () => {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [isOpen, setIsOpen] = useState(false)
  const menuRef = useRef(null)

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const displayName = user?.name || user?.email || 'User'
  const initials = displayName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('')

  const displaySubtitle = user?.email ? user.email : 'Cuenta'

  return (
    <div ref={menuRef} className="relative inline-block text-left">
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        className="inline-flex items-center gap-3 rounded-full border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-900 shadow-sm transition hover:bg-slate-50"
        aria-haspopup="true"
        aria-expanded={isOpen}
      >
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-slate-200 text-sm font-semibold text-slate-700">
          {initials || 'U'}
        </span>
        <span className="hidden text-left sm:block">
          <span className="block text-sm font-semibold text-slate-900">{displayName}</span>
          <span className="block truncate text-xs text-slate-500">{displaySubtitle}</span>
        </span>
      </button>

      {isOpen && (
        <div className="absolute right-0 z-20 mt-2 w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg">
          <button
            type="button"
            onClick={() => {
              setIsOpen(false)
              navigate('/profile')
            }}
            className="w-full px-4 py-3 text-left text-sm text-slate-700 transition hover:bg-slate-50"
          >
            My Profile
          </button>
          <button
            type="button"
            onClick={() => {
              setIsOpen(false)
              navigate('/profile#security')
            }}
            className="w-full px-4 py-3 text-left text-sm text-slate-700 transition hover:bg-slate-50"
          >
            Security
          </button>
          <div className="border-t border-slate-100" />
          <button
            type="button"
            onClick={() => {
              logout()
              setIsOpen(false)
              navigate('/login')
            }}
            className="w-full px-4 py-3 text-left text-sm text-slate-700 transition hover:bg-slate-50"
          >
            Logout
          </button>
        </div>
      )}
    </div>
  )
}

export default ProfileMenu

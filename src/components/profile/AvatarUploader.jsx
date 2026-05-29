import { useEffect, useRef, useState } from 'react'

const AvatarUploader = ({ avatarUrl, displayName, onChange }) => {
  const [preview, setPreview] = useState(avatarUrl)
  const fileInputRef = useRef(null)

  useEffect(() => {
    setPreview(avatarUrl)
  }, [avatarUrl])

  const fallbackInitials = displayName
    ?.split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'U'

  const handleFileChange = (event) => {
    const file = event.target.files?.[0]
    if (!file || !file.type.startsWith('image/')) {
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      setPreview(reader.result)
      onChange(reader.result)
    }
    reader.readAsDataURL(file)
  }

  return (
    <div className="space-y-4">
      <label className="text-sm font-semibold text-slate-900">Avatar</label>
      <div className="flex flex-wrap items-center gap-4">
        <div className="inline-flex h-20 w-20 items-center justify-center overflow-hidden rounded-full bg-slate-100 text-xl font-semibold text-slate-700 ring-1 ring-slate-200">
          {preview ? (
            <img src={preview} alt="Avatar preview" className="h-full w-full object-cover" />
          ) : (
            <span>{fallbackInitials}</span>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="btn btn-outline btn-sm"
          >
            Cambiar avatar
          </button>
          {preview ? (
            <button
              type="button"
              onClick={() => {
                setPreview('')
                onChange('')
              }}
              className="btn btn-ghost btn-sm"
            >
              Eliminar
            </button>
          ) : null}
        </div>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />
    </div>
  )
}

export default AvatarUploader

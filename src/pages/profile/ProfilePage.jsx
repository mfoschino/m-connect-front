import ProfileForm from '../../components/profile/ProfileForm'
import PasswordForm from '../../components/profile/PasswordForm'
import ProfileHeader from '../../components/profile/ProfileHeader'
import useProfile from '../../hooks/useProfile'

const ProfilePage = () => {
  const {
    profile,
    setProfile,
    profileStatus,
    passwordStatus,
    saveProfile,
    changePassword,
  } = useProfile()

  // ProfilePage is intentionally separate from platform settings.
  // User-specific profile and security controls belong here, while /settings remains system-level.

  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500">Perfil</p>
        <h2 className="section-title">Tu cuenta personal</h2>
        <p className="section-subtitle">
          Gestiona tu información de usuario, avatar y seguridad desde un único lugar.
        </p>
      </div>

      <ProfileHeader avatarUrl={profile.avatarUrl} name={profile.name} email={profile.email} />

      <div className="grid gap-6 xl:grid-cols-[1.4fr_0.95fr]">
        <ProfileForm
          profile={profile}
          onChange={setProfile}
          onSave={saveProfile}
          status={profileStatus}
        />
        <PasswordForm onSave={changePassword} status={passwordStatus} />
      </div>
    </div>
  )
}

export default ProfilePage

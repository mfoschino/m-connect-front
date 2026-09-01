import { Outlet } from 'react-router-dom'
import Header from '../components/common/Header'
import Sidebar from '../components/common/Sidebar'

const MainLayout = () => {
  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <Header />
      <div className="flex min-h-[calc(100vh-88px)]">
        <Sidebar />
        <main className="flex-1 mx-auto max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

export default MainLayout

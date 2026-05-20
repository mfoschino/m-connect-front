import { Outlet } from 'react-router-dom'
import Header from '../components/common/Header'
import Sidebar from '../components/common/Sidebar'

const MainLayout = () => {
  return (
    <div className="min-h-screen bg-slate-50">
      <Header />
      <div className="flex">
        <Sidebar />
        <main className="flex-1 p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

export default MainLayout

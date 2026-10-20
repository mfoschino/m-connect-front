import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

// Cada vez que cambia la página, vuelve el scroll arriba de todo
const ScrollToTop = () => {
  const { pathname } = useLocation()

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])

  return null
}

export default ScrollToTop
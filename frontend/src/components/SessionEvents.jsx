import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useToast } from '../context/ToastContext'

function SessionEvents() {
  const navigate = useNavigate()
  const { pushToast } = useToast()

  useEffect(() => {
    const handleUnauthorized = () => {
      pushToast({
        type: 'warning',
        title: 'Session expired',
        description: 'Please sign in again to continue.',
        duration: 4500,
      })
      navigate('/login', { replace: true })
    }

    window.addEventListener('app:unauthorized', handleUnauthorized)

    return () => {
      window.removeEventListener('app:unauthorized', handleUnauthorized)
    }
  }, [navigate, pushToast])

  return null
}

export default SessionEvents

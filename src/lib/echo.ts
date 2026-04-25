import Echo from 'laravel-echo'
import Pusher from 'pusher-js'

let _echo: Echo<'reverb'> | null = null

export function initEcho(): Echo<'reverb'> {
  if (_echo) return _echo

  const token = localStorage.getItem('verbum_token') ?? ''

  _echo = new Echo({
    broadcaster: 'reverb',
    key: import.meta.env.VITE_REVERB_APP_KEY,
    wsHost: import.meta.env.VITE_REVERB_HOST ?? 'localhost',
    wsPort: Number(import.meta.env.VITE_REVERB_PORT ?? 8080),
    wssPort: Number(import.meta.env.VITE_REVERB_PORT ?? 8080),
    forceTLS: (import.meta.env.VITE_REVERB_SCHEME ?? 'http') === 'https',
    enabledTransports: ['ws', 'wss'],
    authEndpoint: `${import.meta.env.VITE_API_URL ?? 'http://localhost:8000'}/broadcasting/auth`,
    auth: {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
    },
    Pusher,
  })

  return _echo
}

export function getEcho(): Echo<'reverb'> | null {
  return _echo
}

export function destroyEcho(): void {
  _echo?.disconnect()
  _echo = null
}


import type { PresenceUser } from '@/types'
import { cn } from '@/lib/cn'

interface PresenceAvatarsProps {
  users: PresenceUser[]
}

const MAX_VISIBLE = 3

export function PresenceAvatars({ users }: PresenceAvatarsProps) {
  if (users.length === 0) return null

  const visible  = users.slice(0, MAX_VISIBLE)
  const overflow = users.length - MAX_VISIBLE
  const label    = users.map((u) => u.name).join(', ') + ' reading this chapter'

  return (
    <div className="flex items-center -space-x-1" title={label} aria-label={label}>
      {visible.map((user) => (
        <span
          key={user.id}
          title={user.name}
          style={{
            backgroundColor: user.color + '33',
            color:           user.color,
            borderColor:     user.color + '66',
          }}
          className={cn(
            'w-5 h-5 rounded-full text-2xs font-medium flex items-center justify-center shrink-0',
            'ring-1 ring-bg-primary border select-none',
          )}
        >
          {user.name.charAt(0).toUpperCase()}
        </span>
      ))}
      {overflow > 0 && (
        <span
          className={cn(
            'w-5 h-5 text-2xs bg-bg-tertiary text-text-muted rounded-full font-medium',
            'flex items-center justify-center shrink-0 ring-1 ring-bg-primary',
          )}
          title={`+${overflow} more`}
        >
          +{overflow}
        </span>
      )}
    </div>
  )
}

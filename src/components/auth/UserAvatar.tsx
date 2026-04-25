

import { cn } from '@/lib/cn'

interface UserAvatarProps {
  email: string
  size?: 'sm' | 'md'
  className?: string
}

export function UserAvatar({ email, size = 'md', className }: UserAvatarProps) {
  const initial = email.charAt(0).toUpperCase()

  return (
    <span
      title={email}
      className={cn(
        'bg-accent/20 text-accent rounded-full font-medium flex items-center justify-center shrink-0',
        size === 'sm' && 'w-5 h-5 text-2xs',
        size === 'md' && 'w-7 h-7 text-xs',
        className
      )}
    >
      {initial}
    </span>
  )
}

import { useState } from 'react'
import type { Note } from '@/lib/store/useNoteStore'
import { useNoteStore } from '@/lib/store/useNoteStore'
import { useUIStore } from '@/lib/store/useUIStore'
import { cn } from '@/lib/cn'
import NoteEditor from '@/components/notes/NoteEditor'

interface NoteItemProps {
  note: Note
  verseApiId: number
}

function formatRelativeTime(isoString: string): string {
  const now = Date.now()
  const then = new Date(isoString).getTime()
  const diffMs = now - then
  const diffSecs = Math.floor(diffMs / 1000)
  const diffMins = Math.floor(diffSecs / 60)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffSecs < 60) return 'Just now'
  if (diffMins < 60) return diffMins === 1 ? '1 minute ago' : `${diffMins} minutes ago`
  if (diffHours < 24) return diffHours === 1 ? '1 hour ago' : `${diffHours} hours ago`
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 30) return `${diffDays} days ago`
  const diffMonths = Math.floor(diffDays / 30)
  if (diffMonths < 12) return diffMonths === 1 ? '1 month ago' : `${diffMonths} months ago`
  const diffYears = Math.floor(diffMonths / 12)
  return diffYears === 1 ? '1 year ago' : `${diffYears} years ago`
}

export default function NoteItem({ note, verseApiId }: NoteItemProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  const updateNote = useNoteStore((s) => s.updateNote)
  const deleteNote = useNoteStore((s) => s.deleteNote)
  const addToast = useUIStore((s) => s.addToast)

  async function handleSave(body: string) {
    try {
      await updateNote(verseApiId, note.id, body)
      setIsEditing(false)
    } catch {
      addToast('Failed to update note', 'error')
    }
  }

  async function handleDelete() {
    try {
      await deleteNote(verseApiId, note.id)
      addToast('Note deleted', 'info')
    } catch {
      addToast('Failed to delete note', 'error')
    }
  }

  const authorName = note.user?.name ?? note.user?.email ?? 'Unknown'
  const relativeTime = formatRelativeTime(note.created_at)

  return (
    <div className="bg-bg-tertiary rounded-lg p-3 group relative">
      {isEditing ? (
        <NoteEditor
          initialValue={note.body}
          onSave={handleSave}
          onCancel={() => setIsEditing(false)}
        />
      ) : (
        <>
          <p className="text-sm text-text-primary leading-relaxed whitespace-pre-wrap break-words">
            {note.body}
          </p>

          <div className="flex items-center justify-between mt-2">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-text-muted">{authorName}</span>
              <span className="text-[10px] text-text-muted">·</span>
              <span className="text-[10px] text-text-muted">{relativeTime}</span>
            </div>

            {/* Action buttons — visible on hover */}
            <div
              className={cn(
                'flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity',
              )}
            >
              {confirmingDelete ? (
                <>
                  <span className="text-[10px] text-text-muted mr-1">Delete?</span>
                  <button
                    type="button"
                    onClick={handleDelete}
                    className="text-[10px] px-1.5 py-0.5 rounded text-red-400 hover:bg-red-400/10 transition-colors font-medium"
                  >
                    Yes
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmingDelete(false)}
                    className="text-[10px] px-1.5 py-0.5 rounded text-text-secondary hover:bg-bg-primary transition-colors"
                  >
                    No
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => setIsEditing(true)}
                    className="text-[10px] px-1.5 py-0.5 rounded text-text-secondary hover:text-text-primary hover:bg-bg-primary transition-colors"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmingDelete(true)}
                    className="text-[10px] px-1.5 py-0.5 rounded text-text-secondary hover:text-red-400 hover:bg-red-400/10 transition-colors"
                  >
                    Delete
                  </button>
                </>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

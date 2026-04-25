
import type { Highlight } from '@/types'

interface VerseTextProps {
  text: string
  highlights: Highlight[]
  className?: string
  inline?: boolean
}

type Segment = {
  start: number
  end: number
  color: 'yellow' | 'blue' | 'green' | null
}

const HIGHLIGHT_COLOR_CLASSES: Record<'yellow' | 'blue' | 'green', string> = {
  yellow: 'bg-[#e5c07b33]',
  blue: 'bg-[#61afef33]',
  green: 'bg-[#98c37933]',
}

function buildSegments(text: string, highlights: Highlight[]): Segment[] {
  if (!highlights.length) {
    return [{ start: 0, end: text.length, color: null }]
  }

  const sorted = [...highlights].sort((a, b) =>
    a.start_index !== b.start_index
      ? a.start_index - b.start_index
      : a.end_index - b.end_index,
  )

  const colorMap: Array<'yellow' | 'blue' | 'green' | null> = new Array(text.length).fill(null)

  for (const h of sorted) {
    const start = Math.max(0, h.start_index)
    const end = Math.min(text.length, h.end_index)
    for (let i = start; i < end; i++) {
      if (colorMap[i] === null) colorMap[i] = h.color
    }
  }

  const segments: Segment[] = []
  let segStart = 0
  let segColor = colorMap[0]

  for (let i = 1; i <= text.length; i++) {
    const cur = i < text.length ? colorMap[i] : undefined
    if (cur !== segColor) {
      segments.push({ start: segStart, end: i, color: segColor })
      segStart = i
      segColor = cur ?? null
    }
  }

  return segments
}

export function VerseText({ text, highlights, className, inline }: VerseTextProps) {
  const segments = buildSegments(text, highlights)
  const Tag = inline ? 'span' : 'p'
  const defaultClass = inline ? undefined : 'text-base text-text-primary leading-relaxed'

  return (
    <Tag className={className ?? defaultClass}>
      {segments.map((seg, idx) => {
        const content = text.slice(seg.start, seg.end)
        if (seg.color === null) return <span key={idx}>{content}</span>
        return (
          <mark key={idx} className={`${HIGHLIGHT_COLOR_CLASSES[seg.color]} text-text-primary rounded-sm`}>
            {content}
          </mark>
        )
      })}
    </Tag>
  )
}

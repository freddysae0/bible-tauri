export const isMac = typeof navigator !== 'undefined' && /Mac/i.test(navigator.platform)
export const modKey = isMac ? '⌘' : 'Ctrl+'

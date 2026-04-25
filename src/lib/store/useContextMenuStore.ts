import { create } from 'zustand'
import type { ReactNode } from 'react'

export type MenuItemAction = {
  type: 'action'
  label: string
  icon?: ReactNode
  shortcut?: string
  danger?: boolean
  disabled?: boolean
  onClick: () => void
}

export type MenuItemSeparator = { type: 'separator' }

export type MenuItemLabel = { type: 'label'; text: string }

export type MenuItem = MenuItemAction | MenuItemSeparator | MenuItemLabel

type ContextMenuState = {
  open: boolean
  x: number
  y: number
  items: MenuItem[]
  openMenu: (x: number, y: number, items: MenuItem[]) => void
  closeMenu: () => void
}

export const useContextMenuStore = create<ContextMenuState>((set) => ({
  open: false,
  x: 0,
  y: 0,
  items: [],
  openMenu: (x, y, items) => set({ open: true, x, y, items }),
  closeMenu: () => set({ open: false, items: [] }),
}))

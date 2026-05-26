import { create } from 'zustand'

export type ToastType = 'success' | 'error' | 'info' | 'warning'

export interface Toast {
  id: string
  type: ToastType
  title: string
  message?: string
  duration?: number // ms, default 4000, 0 = persistent
}

interface ToastStore {
  toasts: Toast[]
  add: (toast: Omit<Toast, 'id'>) => string
  remove: (id: string) => void
  clear: () => void
}

let counter = 0

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  add: (toast) => {
    const id = `toast-${Date.now()}-${++counter}`
    set((s) => ({ toasts: [...s.toasts, { ...toast, id }] }))
    return id
  },
  remove: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
  clear: () => set({ toasts: [] }),
}))

// Convenience hook
export function useToast() {
  const { add, remove, clear } = useToastStore()

  return {
    success: (title: string, message?: string, duration = 4000) =>
      add({ type: 'success', title, message, duration }),
    error: (title: string, message?: string, duration = 6000) =>
      add({ type: 'error', title, message, duration }),
    info: (title: string, message?: string, duration = 4000) =>
      add({ type: 'info', title, message, duration }),
    warning: (title: string, message?: string, duration = 5000) =>
      add({ type: 'warning', title, message, duration }),
    dismiss: remove,
    clear,
  }
}

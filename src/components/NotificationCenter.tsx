import { useState, useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/store/toastStore'
import { cn } from '@/lib/utils'

interface Notification {
  id: string
  tenant_id: string
  type: 'campaign_ready' | 'campaign_failed' | 'payment_success' | 'payment_failed' | 'info'
  title: string
  body: string | null
  read: boolean
  link: string | null
  created_at: string
}

const TYPE_STYLES: Record<Notification['type'], { icon: string; cls: string }> = {
  campaign_ready:   { icon: 'ti-check',        cls: 'bg-teal-50 dark:bg-teal-900/20 text-teal-500' },
  campaign_failed:  { icon: 'ti-alert-circle', cls: 'bg-red-50 dark:bg-red-900/20 text-red-500' },
  payment_success:  { icon: 'ti-coin-euro',    cls: 'bg-gold-50 dark:bg-gold-900/20 text-gold-500' },
  payment_failed:   { icon: 'ti-alert-circle', cls: 'bg-red-50 dark:bg-red-900/20 text-red-500' },
  info:             { icon: 'ti-info-circle',  cls: 'bg-blue-50 dark:bg-blue-900/20 text-blue-500' },
}

export function NotificationCenter() {
  const { tenant } = useAuth()
  const qc = useQueryClient()
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const { data: notifications = [] } = useQuery<Notification[]>({
    queryKey: ['notifications', tenant?.id],
    enabled: !!tenant?.id,
    staleTime: 30_000,
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data } = await supabase
        .from('notifications')
        .select('*')
        .eq('tenant_id', tenant!.id)
        .order('created_at', { ascending: false })
        .limit(20)
      return (data ?? []) as Notification[]
    },
  })

  // Realtime: new notifications + toast
  useEffect(() => {
    if (!tenant?.id) return
    const channel = supabase
      .channel(`notifications-${tenant.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `tenant_id=eq.${tenant.id}` },
        (payload) => {
          qc.invalidateQueries({ queryKey: ['notifications', tenant.id] })
          // Show toast for actionable notification types
          const n = payload.new as Notification
          if (!n) return
          const isSuccess = n.type === 'campaign_ready' || n.type === 'payment_success'
          const isError   = n.type === 'campaign_failed' || n.type === 'payment_failed'
          if (isSuccess) {
            toast.success(n.title, n.body ?? undefined)
          } else if (isError) {
            toast.error(n.title, n.body ?? undefined)
          } else {
            toast.info(n.title, n.body ?? undefined)
          }
        }
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [tenant?.id])

  const unread = notifications.filter(n => !n.read).length

  const markAllRead = useMutation({
    mutationFn: async () => {
      await supabase
        .from('notifications')
        .update({ read: true })
        .eq('tenant_id', tenant!.id)
        .eq('read', false)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications', tenant?.id] }),
  })

  const markRead = async (id: string) => {
    await supabase.from('notifications').update({ read: true }).eq('id', id)
    qc.invalidateQueries({ queryKey: ['notifications', tenant?.id] })
  }

  return (
    <div className="relative" ref={panelRef}>
      {/* Bell button */}
      <button
        onClick={() => setOpen(!open)}
        className="relative w-8 h-8 rounded-xl flex items-center justify-center text-sand-900/50 dark:text-night-50/50 hover:bg-sand-100 dark:hover:bg-night-700 transition-colors"
      >
        <i className="ti ti-bell text-base" />
        {unread > 0 && (
          <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-gold-400 ring-2 ring-white dark:ring-night-800" />
        )}
      </button>

      {/* Panel */}
      {open && (
        <div className="absolute right-0 top-10 w-80 bg-white dark:bg-night-800 rounded-2xl border border-sand-200 dark:border-night-700 shadow-2xl shadow-black/10 z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-sand-100 dark:border-night-700">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-sand-900 dark:text-night-50">Notificaciones</span>
              {unread > 0 && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-gold-400 text-night-900">
                  {unread}
                </span>
              )}
            </div>
            {unread > 0 && (
              <button
                onClick={() => markAllRead.mutate()}
                className="text-xs text-sand-900/40 dark:text-night-50/40 hover:text-sand-900 dark:hover:text-night-50 transition-colors"
              >
                Marcar todo leído
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="py-10 text-center">
                <i className="ti ti-bell-off text-2xl text-sand-300 dark:text-night-600" />
                <p className="text-xs text-sand-900/40 dark:text-night-50/40 mt-2">Sin notificaciones</p>
              </div>
            ) : (
              notifications.map(n => {
                const { icon, cls } = TYPE_STYLES[n.type]
                const content = (
                  <div
                    key={n.id}
                    className={cn(
                      'flex gap-3 px-4 py-3 border-b border-sand-50 dark:border-night-700/50 last:border-0 cursor-pointer transition-colors',
                      !n.read ? 'bg-gold-50/50 dark:bg-gold-900/5 hover:bg-gold-50 dark:hover:bg-gold-900/10' : 'hover:bg-sand-50 dark:hover:bg-night-700/30'
                    )}
                    onClick={() => !n.read && markRead(n.id)}
                  >
                    <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5', cls)}>
                      <i className={`ti ${icon} text-sm`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-1">
                        <p className={cn('text-xs font-semibold leading-snug', !n.read ? 'text-sand-900 dark:text-night-50' : 'text-sand-900/70 dark:text-night-50/70')}>
                          {n.title}
                        </p>
                        {!n.read && <div className="w-1.5 h-1.5 rounded-full bg-gold-400 shrink-0 mt-1" />}
                      </div>
                      {n.body && (
                        <p className="text-[11px] text-sand-900/50 dark:text-night-50/50 mt-0.5 leading-snug line-clamp-2">
                          {n.body}
                        </p>
                      )}
                      <p className="text-[10px] text-sand-900/30 dark:text-night-50/30 mt-1">
                        {formatDistanceToNow(new Date(n.created_at), { locale: es, addSuffix: true })}
                      </p>
                    </div>
                  </div>
                )
                return n.link ? (
                  <Link key={n.id} to={n.link} onClick={() => { setOpen(false); if (!n.read) markRead(n.id) }}>
                    {content}
                  </Link>
                ) : content
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}

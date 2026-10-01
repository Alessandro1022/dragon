import { useEffect } from 'react'
import { useGame, type Toast } from '../store/gameStore'

export function Toasts() {
  const toasts = useGame((s) => s.toasts)
  return (
    <div className="pointer-events-none absolute inset-x-0 top-20 z-40 flex flex-col items-center gap-2 px-4 sm:top-6">
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} />
      ))}
    </div>
  )
}

function ToastItem({ toast }: { toast: Toast }) {
  const dismiss = useGame((s) => s.dismissToast)
  useEffect(() => {
    const id = setTimeout(() => dismiss(toast.id), toast.tone === 'gold' ? 4200 : 2600)
    return () => clearTimeout(id)
  }, [toast, dismiss])
  const tone =
    toast.tone === 'gold'
      ? 'border-ember/40 text-[#fde68a] shadow-[0_0_30px_rgb(245_176_65/0.25)]'
      : toast.tone === 'warn'
        ? 'border-red-400/40 text-red-200'
        : 'border-white/10 text-white'
  return <div className={`glass rise max-w-sm rounded-full border px-4 py-2 text-center text-sm font-semibold ${tone}`}>{toast.text}</div>
}

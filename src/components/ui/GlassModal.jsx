export default function GlassModal({ open = true, onClose, className = '', children }) {
  if (!open) return null

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className={`bg-glass-100 backdrop-blur-2xl border border-glass-border-strong rounded-2xl p-6 shadow-glass-lg max-w-md w-full ${className}`}
        onClick={e => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  )
}

export default function GlassCard({ className = '', children, ...props }) {
  return (
    <div
      className={`bg-glass-50 backdrop-blur-xl border border-glass-border rounded-2xl shadow-glass ${className}`}
      {...props}
    >
      {children}
    </div>
  )
}

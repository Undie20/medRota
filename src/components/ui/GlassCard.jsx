export default function GlassCard({ className = '', children, ...props }) {
  return (
    <div
      className={`glass-panel rounded-2xl shadow-glass ${className}`}
      {...props}
    >
      {children}
    </div>
  )
}

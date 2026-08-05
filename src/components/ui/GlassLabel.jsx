export default function GlassLabel({ className = '', children, ...props }) {
  return (
    <label className={`text-slate-400 text-xs uppercase tracking-widest block mb-2 ${className}`} {...props}>
      {children}
    </label>
  )
}

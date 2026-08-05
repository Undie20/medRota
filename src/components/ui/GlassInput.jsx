export default function GlassInput({ className = '', as = 'input', ...props }) {
  const Tag = as
  return (
    <Tag
      className={`w-full bg-glass-50 border border-glass-border rounded-xl px-4 py-3 text-white text-sm placeholder:text-slate-500 backdrop-blur-xl transition-colors focus:outline-none focus:border-accent-blue/60 focus:bg-glass-100 ${className}`}
      {...props}
    />
  )
}

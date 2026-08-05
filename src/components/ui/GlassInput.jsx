export default function GlassInput({ className = '', as = 'input', ...props }) {
  const Tag = as
  return (
    <Tag
      className={`glass-input w-full rounded-xl px-4 py-3 text-white text-sm placeholder:text-slate-500 focus:outline-none ${className}`}
      {...props}
    />
  )
}

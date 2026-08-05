const variants = {
  primary:
    'text-white bg-gradient-to-b from-accent-blue to-[#3f5fc4] shadow-glow-accent hover:brightness-110 border border-white/20',
  secondary:
    'glass-panel text-white hover:bg-glass-200',
  danger:
    'text-red-300 bg-red-500/10 hover:bg-red-500/15 border border-red-400/20',
  ghost:
    'text-slate-300 hover:text-white hover:bg-glass-50',
}

export default function GlassButton({ variant = 'primary', className = '', children, ...props }) {
  return (
    <button
      className={`rounded-xl py-2.5 px-4 text-sm font-medium transition-all duration-150 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none disabled:active:scale-100 ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}

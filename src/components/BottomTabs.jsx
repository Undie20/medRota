// BottomTabs.jsx - mobile navigation
// Only rendered below md. Glass material, sticks to the bottom of the
// viewport and respects the iPhone home indicator via .pb-safe.
// Every tab is at least 44px tall (Apple's minimum hit target).

import { navItemsFor } from './navItems'

export default function BottomTabs({ currentPage, onNavigate, profile }) {
  const navItems = navItemsFor(profile)

  return (
    <nav
      className="md:hidden shrink-0 sticky bottom-0 z-30 grid px-1.5 pt-1.5 pb-safe
        bg-glass backdrop-blur-xl border-t border-sep shadow-[inset_0_1px_0_var(--c-hair)]"
      style={{ gridTemplateColumns: `repeat(${navItems.length}, minmax(0, 1fr))` }}
    >
      {navItems.map(item => (
        <button
          key={item.key}
          onClick={() => onNavigate(item.key)}
          className={`min-h-[52px] flex flex-col items-center justify-center gap-[3px] rounded-xl transition-colors ${
            currentPage === item.key ? 'text-accent' : 'text-label3'
          }`}
        >
          <span className="w-[23px] h-[23px]">{item.icon}</span>
          <span className="text-[10.5px] font-semibold tracking-[-0.01em]">{item.label}</span>
        </button>
      ))}
    </nav>
  )
}

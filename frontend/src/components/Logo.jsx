export default function Logo({ className = "w-8 h-8 rounded-xl", iconSize = "w-4 h-4" }) {
  return (
    <div className={`${className} shrink-0 relative flex items-center justify-center bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 shadow-[0_0_15px_rgba(139,92,246,0.3)] border border-white/20 overflow-hidden`}>
      {/* Shine effect */}
      <div className="absolute top-0 inset-x-0 h-px bg-white/60"></div>
      <div className="absolute inset-0 bg-gradient-to-b from-white/20 to-transparent"></div>
      
      {/* AI Sparkle Icon */}
      <svg className={`${iconSize} text-white relative z-10 drop-shadow-sm`} viewBox="0 0 24 24" fill="currentColor">
        {/* Main Star */}
        <path d="M12 1L14.39 8.609L22 11L14.39 13.39L12 21L9.609 13.39L2 11L9.609 8.609L12 1Z" />
        {/* Small Stars */}
        <path d="M19 3L19.8 5.2L22 6L19.8 6.8L19 9L18.2 6.8L16 6L18.2 5.2L19 3Z" opacity="0.8"/>
        <path d="M5 16L5.6 17.8L7.5 18.5L5.6 19.2L5 21L4.4 19.2L2.5 18.5L4.4 17.8L5 16Z" opacity="0.6"/>
      </svg>
    </div>
  )
}

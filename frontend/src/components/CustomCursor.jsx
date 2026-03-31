import { useEffect, useRef, useState } from 'react'

export default function CustomCursor() {
  const cursorRef = useRef(null)
  const ringRef = useRef(null)
  const [isHovering, setIsHovering] = useState(false)

  useEffect(() => {
    let mx = 0, my = 0, rx = 0, ry = 0

    const handleMouseMove = (e) => {
      mx = e.clientX
      my = e.clientY
      if (cursorRef.current) {
        cursorRef.current.style.left = mx + 'px'
        cursorRef.current.style.top = my + 'px'
      }
    }

    const handleMouseOver = (e) => {
      const target = e.target
      if (target.tagName === 'A' || target.tagName === 'BUTTON' || target.closest('a') || target.closest('button')) {
        setIsHovering(true)
      } else {
        setIsHovering(false)
      }
    }

    function animRing() {
      rx += (mx - rx) * 0.12
      ry += (my - ry) * 0.12
      if (ringRef.current) {
        ringRef.current.style.left = rx + 'px'
        ringRef.current.style.top = ry + 'px'
      }
      requestAnimationFrame(animRing)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseover', handleMouseOver)
    const animationId = requestAnimationFrame(animRing)

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseover', handleMouseOver)
      cancelAnimationFrame(animationId)
    }
  }, [])

  return (
    <>
      <div
        ref={cursorRef}
        id="cursor"
        className="fixed top-0 left-0 pointer-events-none z-[9999] rounded-full transition-[width,height,background] duration-200"
        style={{
          width: isHovering ? '12px' : '8px',
          height: isHovering ? '12px' : '8px',
          background: 'var(--analisai-cyan)',
          transform: 'translate(-50%, -50%)',
          boxShadow: '0 0 12px var(--analisai-cyan)',
        }}
      />
      <div
        ref={ringRef}
        id="cursor-ring"
        className="fixed top-0 left-0 pointer-events-none z-[9998] rounded-full border border-sky-400/40 transition-[width,height,opacity] duration-300"
        style={{
          width: '32px',
          height: '32px',
          transform: 'translate(-50%, -50%)',
        }}
      />
      <style>{`
        body { cursor: none !important; }
        @media (max-width: 768px) {
          body { cursor: auto !important; }
          #cursor, #cursor-ring { display: none !important; }
        }
      `}</style>
    </>
  )
}

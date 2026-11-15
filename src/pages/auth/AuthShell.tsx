import { useEffect, useState, type ReactNode } from 'react'
import { brand, loginSlides, slideSeconds } from '../../config/brand'
import { LogoMark } from '../../components/Brand'
import { cx } from '../../components/ui'

/** Rotates through the nature pictures; every layer shares the same index. */
function useSlideIndex() {
  const [index, setIndex] = useState(0)
  useEffect(() => {
    if (loginSlides.length < 2) return
    const t = setInterval(() => setIndex((i) => (i + 1) % loginSlides.length), slideSeconds * 1000)
    return () => clearInterval(t)
  }, [])
  return [index, setIndex] as const
}

function SlideLayers({ index, className }: { index: number; className?: string }) {
  return (
    <>
      {loginSlides.map((s, i) => (
        <img
          key={s.src}
          src={s.src}
          alt={i === index ? s.alt : ''}
          aria-hidden={i !== index}
          loading={i === 0 ? 'eager' : 'lazy'}
          className={cx('slide absolute inset-0 w-full h-full object-cover', i === index ? 'opacity-100 scale-105' : 'opacity-0 scale-100', className)}
        />
      ))}
    </>
  )
}

/** Login-style screen: blurred picture behind a glass card, picture panel on the right. */
export function AuthShell({ children }: { children: ReactNode }) {
  const [index, setIndex] = useSlideIndex()

  return (
    <div className="relative min-h-full flex items-center justify-center p-3 sm:p-6 lg:p-10 overflow-hidden">
      {/* Background: same picture, enlarged and blurred */}
      <div aria-hidden className="fixed inset-0 -z-10 overflow-hidden bg-[#2b2140]">
        <SlideLayers index={index} className="blur-md scale-110" />
        <div className="absolute inset-0 bg-black/10" />
      </div>

      <div className="glass window-shadow w-full max-w-[1180px] rounded-[34px] p-2.5 sm:p-3 grid md:grid-cols-2 min-h-[min(720px,calc(100vh-48px))]">
        {/* Left: form */}
        <div className="flex flex-col px-5 py-8 sm:px-10 sm:py-10">
          <div className="flex items-center gap-2.5 md:hidden mb-8">
            <LogoMark size={36} />
            <span className="font-semibold text-ink">{brand.appName}</span>
          </div>
          <div className="flex-1 flex items-center justify-center">
            <div className="w-full max-w-[360px]">{children}</div>
          </div>
        </div>

        {/* Right: changing nature pictures */}
        <div className="relative hidden md:block rounded-[26px] overflow-hidden bg-[#2b2140]">
          <SlideLayers index={index} />
          <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/5 to-transparent" />
          <LogoMark size={52} className="absolute top-6 right-6 shadow-lg" />
          <div className="absolute left-0 right-0 bottom-0 p-8 lg:p-10 text-white">
            <p className="text-[34px] lg:text-[44px] leading-[1.08] font-light tracking-tight">
              {brand.taglineStart} <span className="font-bold">{brand.taglineBold}</span>
            </p>
            {loginSlides.length > 1 && (
              <div className="flex gap-1.5 mt-6" role="tablist" aria-label="Pictures">
                {loginSlides.map((s, i) => (
                  <button
                    key={s.src}
                    type="button"
                    role="tab"
                    aria-selected={i === index}
                    aria-label={`Picture ${i + 1}`}
                    onClick={() => setIndex(i)}
                    className={cx('h-1.5 rounded-full transition-all cursor-pointer', i === index ? 'w-7 bg-white' : 'w-1.5 bg-white/50 hover:bg-white/80')}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

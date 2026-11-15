import { brand, wallpaper } from '../config/brand'
import { cx } from './ui'

export function LogoMark({ size = 44, className }: { size?: number; className?: string }) {
  return (
    <span
      aria-label={brand.appName}
      style={{ width: size, height: size, fontSize: size * 0.48 }}
      className={cx('rounded-full bg-[#111] text-white grid place-items-center font-extrabold tracking-tight leading-none select-none', className)}
    >
      {brand.shortMark}
    </span>
  )
}

/** Full-screen picture behind windows. */
export function Wallpaper({ src = wallpaper, blur = false }: { src?: string; blur?: boolean }) {
  return (
    <div aria-hidden className="fixed inset-0 -z-10 overflow-hidden bg-[#2b2140]">
      <img src={src} alt="" className={cx('w-full h-full object-cover', blur && 'scale-110 blur-2xl')} />
      <div className="absolute inset-0 bg-black/10" />
    </div>
  )
}

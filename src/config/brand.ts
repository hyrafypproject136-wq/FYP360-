/**
 * Pictures and words for the login page and the window wallpaper.
 * To use your own pictures: put them in /public/slides/ and change `src`,
 * for example  src: '/slides/campus.jpg'.
 */
export interface Slide {
  src: string
  /** Short description for screen readers. */
  alt: string
}

const unsplash = (id: string) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=1920&q=80`

export const loginSlides: Slide[] = [
  { src: unsplash('photo-1506905925346-21bda4d32df4'), alt: 'Mountain peaks above the clouds at sunrise' },
  { src: unsplash('photo-1501785888041-af3ef285b470'), alt: 'Lake between mountains at dawn' },
  { src: unsplash('photo-1470071459604-3b5ec3a7fe05'), alt: 'Misty green hills' },
  { src: unsplash('photo-1441974231531-c6227db76b6e'), alt: 'Sunlight through a forest' },
  { src: unsplash('photo-1469474968028-56623f02e42e'), alt: 'Valley with a river at sunset' },
]

/** Seconds each login picture stays before fading to the next. */
export const slideSeconds = 6

/** Wallpaper behind the admin and portal windows. */
export const wallpaper = loginSlides[0].src

export const brand = {
  appName: 'FYP360',
  shortMark: 'f.',
  taglineStart: 'Build your Final Year Project',
  taglineBold: 'Together',
}

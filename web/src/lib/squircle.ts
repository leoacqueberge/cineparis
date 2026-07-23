/** Default Figma-like smoothing for CineParis UI. */
export const SMOOTHING = 0.6

export function corners(radius: number) {
  return { radius, smoothing: SMOOTHING }
}

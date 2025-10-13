export const getIconPath = (name: string) => {
  try {
    return new URL(`/src/assets/${name}.svg`, import.meta.url).href
  } catch (e) {
    console.warn(`Icon ${name}.svg not found in /assets`)
    return new URL(`/src/assets/default.svg`, import.meta.url).href
  }
}

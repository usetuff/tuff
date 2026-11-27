import type { WebFront } from './editionShape.js'

/*
 * Tuff on your own server has no site in front of it.
 * The mirror copies this file over
 * `edition.front.tsx`: no address is a page of a site, so every one is the
 * app's, and `/` is its sign-in.
 */
export const front: WebFront = {
  page: () => null,
  boot: () => {},
}

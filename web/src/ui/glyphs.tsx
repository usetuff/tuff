/**
 * The icons, taken from the design file rather than drawn again by hand.
 *
 * Every one of them arrived from Figma as a one-colour SVG with the colour
 * baked in — and baked in twice, because the light and dark frames export
 * different files for the same glyph. Shipping them as assets would mean two
 * copies of every icon and a swap on the theme, so the shapes are kept and
 * the colour is handed back to the page: `currentColor` everywhere, and the
 * callsite decides by setting `color`.
 *
 * That is the one place this file departs from what the design exports, and
 * it is the difference between an icon that follows the theme and one that
 * is the wrong grey in half the product.
 *
 * Not a dependency: seventeen paths weigh less than the smallest icon package
 * and cannot go stale against a design they came from.
 *
 * The attributes inside these strings are SVG's, not React's:
 * `stroke-width`, not `strokeWidth`. Nothing here is JSX — the body goes in
 * through `innerHTML`, so the browser's parser reads it, and that parser
 * lowercases what it does not know. `strokeWidth="1.4"` lands as an
 * attribute called `strokewidth`, which means nothing, and the glyph draws
 * at the default weight of 1. It renders, it is the right shape, and it is
 * thinner than it was drawn — which is why this went unnoticed across
 * thirteen of them, including every chevron and both status marks.
 */
import type { CSSProperties } from 'react'

type Props = {
  /** The box it is drawn in. Non-square glyphs keep their proportion inside it. */
  size?: number
  /**
   * Which of the three things an icon is here.
   *
   * Named rather than coloured at the callsite: the sidebar's own glyphs are
   * the accent, the ones beside content are quiet, and inside a tinted tile
   * they are white. Three answers, and no component picking a grey.
   */
  tone?: 'accent' | 'quiet' | 'inherit'
  style?: CSSProperties
  className?: string
}

const TONE = {
  accent: 'var(--accent)',
  quiet: 'var(--ink-3)',
  inherit: undefined,
} as const

/*
 * No `Record<string, …>` on purpose.
 *
 * Annotated that way, `keyof typeof SHAPES` is `string`, every icon name
 * type-checks, and a typo is a blank square found by looking rather than by
 * compiling. Left to infer, the keys are a union and the compiler knows all
 * twenty-six of them.
 */
const SHAPES = {
  tasks: {
    vb: '0 0 18 18',
    body: `<path d="M9.0002 1.8C12.9766 1.80011 16.2004 5.02381 16.2004 9.0002C16.2003 12.9765 12.9765 16.2003 9.0002 16.2004C5.02381 16.2004 1.80011 12.9766 1.8 9.0002C1.8 5.02375 5.02375 1.8 9.0002 1.8ZM12.9279 6.22871C12.5906 5.89878 12.0493 5.90436 11.7189 6.24141L7.91328 10.1242L6.36445 8.57539C6.03063 8.24193 5.48928 8.24191 5.15547 8.57539C4.82189 8.90925 4.82183 9.45055 5.15547 9.78437L7.31562 11.9445C7.47701 12.1058 7.69683 12.1967 7.925 12.1955C8.15291 12.1942 8.37088 12.1014 8.53047 11.9387L12.9406 7.43867C13.2711 7.10142 13.2652 6.55922 12.9279 6.22871Z" fill="currentColor"/>`,
  },
  bell: {
    vb: '0 0 18 18',
    body: `<path d="M10.9802 14.4004C10.9801 14.9254 10.7713 15.4286 10.4001 15.7998C10.0289 16.171 9.52564 16.3798 9.00067 16.3799C8.47554 16.3799 7.9716 16.1711 7.60027 15.7998C7.22909 15.4286 7.0203 14.9253 7.0202 14.4004H10.9802ZM9.00067 2.25C11.7003 2.25024 13.5005 4.31998 13.5007 6.92969V10.1699L14.8503 12.1504C15.2099 12.6903 14.8502 13.3202 14.2204 13.3203H3.77996C3.15024 13.3202 2.79049 12.6902 3.15008 12.1504L4.50067 10.1699V6.92969C4.50081 4.31983 6.30077 2.25 9.00067 2.25Z" fill="currentColor"/>`,
  },
  /* One person, for the place that asks who: a head over shoulders, on
     the same 18-grid and the same weight as `people`. */
  person: {
    vb: '0 0 18 18',
    body: `<path d="M9 9.9C12.312 9.9 14.9 12.073 14.9 15.3c0 .518-.31.828-.828.828H3.928C3.41 16.128 3.1 15.818 3.1 15.3 3.1 12.073 5.688 9.9 9 9.9ZM9 2.7a3.15 3.15 0 1 1 0 6.3 3.15 3.15 0 0 1 0-6.3Z" fill="currentColor"/>`,
  },
  people: {
    vb: '0 0 18 18',
    body: `<path d="M6.74988 10.0804C9.62984 10.0804 11.8797 11.9699 11.8798 14.8499C11.8798 15.2999 11.61 15.5696 11.16 15.5696H2.33973C1.88989 15.5695 1.62 15.2998 1.62 14.8499C1.62006 11.97 3.86998 10.0804 6.74988 10.0804ZM12.7802 9.89969C15.0301 9.89976 16.5604 11.5204 16.5604 14.0403C16.5603 14.4901 16.2896 14.76 15.8397 14.76H13.6796C13.6796 12.78 13.1401 11.1595 12.2401 9.98953C12.4201 9.98949 12.6002 9.89969 12.7802 9.89969ZM6.74988 2.97C8.34042 2.97 9.6297 4.25936 9.62977 5.84988C9.62977 7.44046 8.34046 8.72977 6.74988 8.72977C5.15936 8.7297 3.87 7.44042 3.87 5.84988C3.87006 4.2594 5.1594 2.97006 6.74988 2.97ZM12.87 3.23953C14.1623 3.23953 15.2098 4.28801 15.2098 5.58035C15.2097 6.87254 14.1622 7.9202 12.87 7.9202C11.5778 7.9202 10.5303 6.87254 10.5302 5.58035C10.5302 4.28801 11.5777 3.23953 12.87 3.23953Z" fill="currentColor"/>`,
  },
  gear: {
    vb: '0 0 18 18',
    body: `<path d="M10.5573 3.17746L12.0154 3.78L13.446 2.87961L15.1198 4.55441L14.2204 5.98508L14.823 7.44309L16.4704 7.82102V10.1794L14.823 10.5573L14.2204 12.0154L15.1198 13.446L13.446 15.1198L12.0154 14.2204L10.5573 14.823L10.1794 16.4704H7.82102L7.44309 14.823L5.98508 14.2204L4.55441 15.1198L2.87961 13.446L3.78 12.0154L3.17746 10.5573L1.53 10.1794V7.82102L3.17746 7.44309L3.78 5.98508L2.87961 4.55441L4.55441 2.87961L5.98508 3.78L7.44309 3.17746L7.82102 1.53H10.1794L10.5573 3.17746ZM8.99973 6.38938C7.55862 6.38962 6.38962 7.55862 6.38938 8.99973C6.38947 10.441 7.55853 11.6098 8.99973 11.6101C10.4411 11.61 11.61 10.4411 11.6101 8.99973C11.6098 7.55853 10.441 6.38947 8.99973 6.38938Z" fill="currentColor"/>`,
  },
  bubble: {
    vb: '0 0 18 18',
    body: `<path d="M9 3.15C5.31 3.15 2.25 5.58 2.25 8.73C2.25 10.44 3.15 11.97 4.59 13.05L3.87 15.3C3.69 15.75 4.14 16.11 4.59 15.93L7.47 14.58C7.92 14.67 8.46 14.76 9 14.76C12.69 14.76 15.75 12.24 15.75 9.18C15.75 6.12 12.69 3.15 9 3.15Z" fill="currentColor"/>`,
  },
  megaphone: {
    vb: '0 0 16 16',
    body: `<path d="M7.6002 13.1197C7.7602 13.5997 7.43957 13.9996 6.95957 13.9996H6.4C6.08005 13.9996 5.84039 13.84 5.76035 13.5201L4.80039 11.0396H6.88047L7.6002 13.1197ZM11.1998 2.80036C11.6798 2.56036 12.1598 2.88001 12.1598 3.44001V12.5601C12.1597 13.12 11.6798 13.4398 11.1998 13.1998L6.88047 10.4H4.15977C3.69307 10.3999 3.24563 10.2144 2.91563 9.88434C2.58562 9.55433 2.40005 9.1069 2.4 8.6402V7.35993C2.40002 6.89321 2.58563 6.44583 2.91563 6.11579C3.24563 5.78578 3.69307 5.60022 4.15977 5.60016H6.88047L11.1998 2.80036ZM13.7604 6.56012C14.1578 6.56031 14.48 6.88239 14.4801 7.27985V8.72028C14.4799 9.11768 14.1577 9.43982 13.7604 9.44001C13.3628 9.44001 13.0398 9.1178 13.0396 8.72028V7.27985C13.0397 6.88227 13.3628 6.56012 13.7604 6.56012Z" fill="currentColor"/>`,
  },
  doc: {
    vb: '0 0 16 16',
    body: `<path d="M8.95977 2C9.27977 2 9.59965 2.16039 9.83965 2.40039L12.7996 5.36035C13.0396 5.60035 13.2 5.92023 13.2 6.24023V12.96C13.2 13.76 12.5596 14.4004 11.7596 14.4004H4.64043C3.84043 14.4004 3.2 13.76 3.2 12.96V3.44043C3.2 2.64043 3.84043 2 4.64043 2H8.95977ZM5.75957 10.2402C5.45055 10.2405 5.20011 10.4908 5.2 10.7998C5.2 11.1089 5.45049 11.3601 5.75957 11.3604H8.79961C9.10889 11.3604 9.36016 11.1091 9.36016 10.7998C9.36005 10.4906 9.10882 10.2402 8.79961 10.2402H5.75957ZM5.75957 7.83984C5.45049 7.84008 5.2 8.09125 5.2 8.40039C5.20021 8.70935 5.45062 8.95973 5.75957 8.95996H10.24C10.549 8.95977 10.7994 8.70937 10.7996 8.40039C10.7996 8.09123 10.5492 7.84003 10.24 7.83984H5.75957Z" fill="currentColor"/>`,
  },
  list: {
    vb: '0 0 16 16',
    body: `<path d="M3.20012 10.4802C3.81862 10.4803 4.32023 10.9818 4.32023 11.6003C4.32007 12.2187 3.81852 12.7204 3.20012 12.7204C2.58166 12.7204 2.08017 12.2187 2.08 11.6003C2.08 10.9818 2.58156 10.4802 3.20012 10.4802ZM13.2001 10.7995C13.6419 10.7996 13.9999 11.1585 13.9999 11.6003C13.9998 12.042 13.6418 12.4001 13.2001 12.4001H6.79973C6.35813 12.4 6.00009 12.0419 5.99992 11.6003C5.99992 11.1586 6.35802 10.7997 6.79973 10.7995H13.2001ZM3.20012 6.87961C3.81853 6.87967 4.32009 7.38133 4.32023 7.99973C4.32023 8.61825 3.81862 9.11978 3.20012 9.11984C2.58156 9.11984 2.08 8.61829 2.08 7.99973C2.08015 7.38129 2.58165 6.87961 3.20012 6.87961ZM13.2001 7.19992C13.6418 7.19998 13.9998 7.55806 13.9999 7.99973C13.9999 8.44152 13.6419 8.79947 13.2001 8.79953H6.79973C6.35802 8.79938 5.99992 8.44146 5.99992 7.99973C6.00007 7.55812 6.35812 7.20007 6.79973 7.19992H13.2001ZM3.20012 3.28C3.81862 3.28006 4.32023 3.7816 4.32023 4.40012C4.32017 5.01858 3.81858 5.52017 3.20012 5.52023C2.5816 5.52023 2.08006 5.01862 2.08 4.40012C2.08 3.78156 2.58156 3.28 3.20012 3.28ZM13.2001 3.60031C13.6419 3.60038 13.9999 3.95833 13.9999 4.40012C13.9999 4.84185 13.6419 5.19986 13.2001 5.19992H6.79973C6.35806 5.19977 5.99999 4.8418 5.99992 4.40012C5.99992 3.95838 6.35802 3.60046 6.79973 3.60031H13.2001Z" fill="currentColor"/>`,
  },
  /*
   * A clock running backwards: what happened, not what is due.
   *
   * It was the list glyph, which is the one thing it could not be — the
   * tab now sits next to Tasks, and two list icons side by side say the two
   * screens hold the same kind of thing. The calendar is taken by a date
   * something is due, so this is a clock with the arrow going the other way.
   */
  history: {
    vb: '0 0 18 18',
    body: `<path d="M2.4 9A6.6 6.6 0 1 0 9 2.4 6.75 6.75 0 0 0 4.2 4.35L2.4 6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/><path d="M2.4 2.55V6.15H6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/><path d="M9 5.4V9.3L12 10.8" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>`,
  },
  /*
   * The product's own mark, and a placeholder until there is a real one.
   *
   * Abstract on purpose: three bars of different lengths inside a rounded
   * square — work of different sizes in a container — which says "a tracker"
   * without pretending to be a name. It is the one glyph here that is not a
   * noun, so it is the one to replace first when somebody draws a logo.
   */
  mark: {
    vb: '0 0 20 20',
    body: `<rect x="1" y="1" width="18" height="18" rx="5.5" fill="currentColor"/><rect x="5" y="6" width="10" height="2" rx="1" fill="var(--canvas)"/><rect x="5" y="9.5" width="7" height="2" rx="1" fill="var(--canvas)"/><rect x="5" y="13" width="4" height="2" rx="1" fill="var(--canvas)"/>`,
  },
  board: {
    vb: '0 0 16 16',
    body: `<path d="M4.32031 2.8C4.93873 2.80017 5.44043 3.30166 5.44043 3.92012V12.0803C5.44028 12.6986 4.93864 13.2002 4.32031 13.2004H3.12012C2.50165 13.2004 2.00015 12.6987 2 12.0803V3.92012C2 3.30156 2.50156 2.8 3.12012 2.8H4.32031ZM8.63965 2.8C9.25821 2.8 9.75977 3.30156 9.75977 3.92012V8.88008C9.75972 9.4986 9.25818 10.0002 8.63965 10.0002H7.44043C6.8219 10.0002 6.32035 9.4986 6.32031 8.88008V3.92012C6.32031 3.30156 6.82187 2.8 7.44043 2.8H8.63965ZM12.8799 2.8C13.4984 2.8 14 3.30156 14 3.92012V6.47969C14 7.09825 13.4984 7.5998 12.8799 7.5998H11.7598C11.1413 7.59968 10.6396 7.09817 10.6396 6.47969V3.92012C10.6396 3.30164 11.1413 2.80013 11.7598 2.8H12.8799Z" fill="currentColor"/>`,
  },
  cal: {
    vb: '0 0 14 14',
    body: `<path d="M12.0401 9.94027C12.0399 11.0998 11.1 12.0396 9.94047 12.0399H4.05961C2.90008 12.0397 1.96015 11.0998 1.96 9.94027V6.05551H12.0401V9.94027ZM4.62016 9.34555C4.29159 9.34555 4.0255 9.61173 4.02543 9.94027C4.02565 10.2687 4.29168 10.535 4.62016 10.535H5.04008C5.36839 10.5348 5.63458 10.2686 5.6348 9.94027C5.63473 9.61184 5.36848 9.34574 5.04008 9.34555H4.62016ZM6.79008 9.34555C6.46164 9.34569 6.19543 9.61182 6.19535 9.94027C6.19557 10.2686 6.46173 10.5349 6.79008 10.535H7.21C7.53841 10.5349 7.8045 10.2686 7.80473 9.94027C7.80465 9.61177 7.5385 9.34562 7.21 9.34555H6.79008ZM4.62016 7.38559C4.29155 7.38559 4.02543 7.6517 4.02543 7.98031C4.0256 8.30878 4.29165 8.57504 4.62016 8.57504H5.04008C5.36842 8.57485 5.63464 8.30866 5.6348 7.98031C5.6348 7.65182 5.36853 7.38578 5.04008 7.38559H4.62016ZM6.79008 7.38559C6.46159 7.38573 6.19535 7.65179 6.19535 7.98031C6.19552 8.30869 6.4617 8.57489 6.79008 8.57504H7.21C7.53844 8.57497 7.80456 8.30873 7.80473 7.98031C7.80473 7.65175 7.53855 7.38566 7.21 7.38559H6.79008ZM8.96 7.38559C8.63145 7.38566 8.3643 7.65175 8.3643 7.98031C8.36447 8.30873 8.63156 8.57497 8.96 8.57504H9.37992C9.7084 8.57501 9.97546 8.30876 9.97562 7.98031C9.97562 7.65172 9.7085 7.38562 9.37992 7.38559H8.96ZM9.94047 2.66C11.0999 2.66025 12.0399 3.60015 12.0401 4.75961V5.14437H1.96V4.75961C1.96021 3.60012 2.90012 2.66021 4.05961 2.66H9.94047Z" fill="currentColor"/>`,
  },
  plus: {
    vb: '0 0 11.34 11.34',
    body: `<path d="M5.67 0.72V10.62M0.72 5.67H10.62" stroke="currentColor" stroke-width="1.44" stroke-linecap="round" stroke-linejoin="round"/>`,
  },
  ellipsis: {
    vb: '0 0 11.34 2.34',
    body: `<path d="M1.17 2.34C1.81617 2.34 2.34 1.81617 2.34 1.17C2.34 0.523827 1.81617 9.53674e-08 1.17 9.53674e-08C0.523827 9.53674e-08 0 0.523827 0 1.17C0 1.81617 0.523827 2.34 1.17 2.34Z" fill="currentColor"/> <path d="M5.67 2.34C6.31617 2.34 6.84 1.81617 6.84 1.17C6.84 0.523827 6.31617 0 5.67 0C5.02383 0 4.5 0.523827 4.5 1.17C4.5 1.81617 5.02383 2.34 5.67 2.34Z" fill="currentColor"/> <path d="M10.17 2.34C10.8162 2.34 11.34 1.81617 11.34 1.17C11.34 0.523827 10.8162 0 10.17 0C9.52383 0 9 0.523827 9 1.17C9 1.81617 9.52383 2.34 10.17 2.34Z" fill="currentColor"/>`,
  },
  search: {
    vb: '0 0 12.24 12.24',
    body: `<path d="M5.12 9.52C7.55005 9.52 9.52 7.55005 9.52 5.12C9.52 2.68995 7.55005 0.72 5.12 0.72C2.68995 0.72 0.72 2.68995 0.72 5.12C0.72 7.55005 2.68995 9.52 5.12 9.52Z" stroke="currentColor" stroke-width="1.44" stroke-linecap="round"/> <path d="M8.48 8.48L11.52 11.52" stroke="currentColor" stroke-width="1.44" stroke-linecap="round"/>`,
  },
  chevron: {
    vb: '0 0 6.08 9.28',
    body: `<path d="M0.64 3.04L3.04 0.64L5.44 3.04M0.64 6.24L3.04 8.64L5.44 6.24" stroke="currentColor" stroke-width="1.28" stroke-linecap="round" stroke-linejoin="round"/>`,
  },
  flag: {
    vb: '0 0 13 13',
    body: `<path d="M3.38 1.82C3.64 1.82 3.9 2.08 3.9 2.34V2.665C4.68 2.275 5.59 2.21 6.565 2.535C7.475 2.795 8.255 2.86 9.165 2.47C9.555 2.275 10.01 2.6 10.01 2.99V7.41C10.01 7.67 9.88 7.865 9.685 7.995C8.515 8.58 7.41 8.515 6.305 8.19C5.46 7.93 4.68 7.93 3.9 8.32V11.31C3.9 11.57 3.64 11.83 3.38 11.83C3.12 11.83 2.86 11.57 2.86 11.31V2.34C2.86 2.08 3.12 1.82 3.38 1.82Z" fill="currentColor"/>`,
  },
  globe: {
    vb: '0 0 13 13',
    body: `<path d="M4.07123 6.9226C4.11267 8.16279 4.33304 9.29379 4.68354 10.1531C4.87113 10.6129 5.10479 11.013 5.38178 11.3113C3.32533 10.8352 1.76157 9.07655 1.57904 6.9226H4.07123ZM11.4208 6.9226C11.2383 9.07659 9.67461 10.8353 7.61811 11.3113C7.89501 11.013 8.12779 10.6128 8.31537 10.1531C8.66587 9.29379 8.88721 8.16279 8.92865 6.9226H11.4208ZM8.08295 6.9226C8.04177 8.07318 7.83683 9.09158 7.53412 9.83373C7.36406 10.2506 7.17182 10.56 6.98041 10.7585C6.79023 10.9557 6.62762 11.0173 6.49994 11.0173C6.37227 11.0172 6.20963 10.9557 6.01947 10.7585C5.82812 10.5601 5.63676 10.2505 5.46674 9.83373C5.16402 9.09158 4.95811 8.0732 4.91693 6.9226H8.08295ZM5.3808 1.68822C5.10386 1.98655 4.8711 2.38757 4.68354 2.8474C4.33312 3.70659 4.1127 4.83696 4.07123 6.07689H1.57904C1.76175 3.92345 3.32491 2.16451 5.3808 1.68822ZM6.49994 1.98314C6.62762 1.98321 6.79023 2.04472 6.98041 2.24193C7.17175 2.44046 7.36412 2.74997 7.53412 3.16674C7.83673 3.9088 8.04175 4.92665 8.08295 6.07689H4.91693C4.95813 4.92651 5.16407 3.90883 5.46674 3.16674C5.63672 2.75002 5.82816 2.44046 6.01947 2.24193C6.20963 2.04475 6.37227 1.98323 6.49994 1.98314ZM7.61908 1.68822C9.67502 2.16447 11.2381 3.92342 11.4208 6.07689H8.92865C8.88719 4.83686 8.66584 3.70662 8.31537 2.8474C8.12781 2.38761 7.89598 1.98653 7.61908 1.68822Z" fill="currentColor"/>`,
  },
  spark: {
    vb: '0 0 9.62 9.62',
    body: `<path d="M4.81 0.585L5.915 3.705L9.035 4.81L5.915 5.915L4.81 9.035L3.705 5.915L0.585 4.81L3.705 3.705L4.81 0.585Z" fill="currentColor" stroke="currentColor" stroke-width="1.17" stroke-linecap="round" stroke-linejoin="round"/>`,
  },
  statusDoing: {
    vb: '0 0 18 18',
    body: `<path d="M9 15.3C12.4794 15.3 15.3 12.4794 15.3 9C15.3 5.52061 12.4794 2.7 9 2.7C5.52061 2.7 2.7 5.52061 2.7 9C2.7 12.4794 5.52061 15.3 9 15.3Z" stroke="currentColor" stroke-width="1.44" stroke-linecap="round" stroke-linejoin="round"/> <path d="M9 4.86C10.098 4.86 11.151 5.29618 11.9274 6.07258C12.7038 6.84898 13.14 7.902 13.14 9C13.14 10.098 12.7038 11.151 11.9274 11.9274C11.151 12.7038 10.098 13.14 9 13.14V4.86Z" fill="currentColor"/>`,
  },
  /*
   * How far round the ring the work has gone: a quarter, a half, three
   * quarters, and then the check. One shape filling up rather than four
   * unrelated pictures — a list's mark says how far along it is, not what
   * it is about. The arcs are all struck from the same circle as the half
   * that was here first, so they line up at any size.
   */
  statusStarted: {
    vb: '0 0 18 18',
    body: `<path d="M9 15.3C12.4794 15.3 15.3 12.4794 15.3 9C15.3 5.52061 12.4794 2.7 9 2.7C5.52061 2.7 2.7 5.52061 2.7 9C2.7 12.4794 5.52061 15.3 9 15.3Z" stroke="currentColor" stroke-width="1.44" stroke-linecap="round" stroke-linejoin="round"/> <path d="M9 9V4.86A4.14 4.14 0 0 1 13.14 9Z" fill="currentColor"/>`,
  },
  statusReview: {
    vb: '0 0 18 18',
    body: `<path d="M9 15.3C12.4794 15.3 15.3 12.4794 15.3 9C15.3 5.52061 12.4794 2.7 9 2.7C5.52061 2.7 2.7 5.52061 2.7 9C2.7 12.4794 5.52061 15.3 9 15.3Z" stroke="currentColor" stroke-width="1.44" stroke-linecap="round" stroke-linejoin="round"/> <path d="M9 9V4.86A4.14 4.14 0 1 1 4.86 9Z" fill="currentColor"/>`,
  },
  /* Not a stage but an ending, so it is a mark rather than more of the arc. */
  statusStopped: {
    vb: '0 0 18 18',
    body: `<path d="M9 15.3C12.4794 15.3 15.3 12.4794 15.3 9C15.3 5.52061 12.4794 2.7 9 2.7C5.52061 2.7 2.7 5.52061 2.7 9C2.7 12.4794 5.52061 15.3 9 15.3Z" stroke="currentColor" stroke-width="1.44" stroke-linecap="round" stroke-linejoin="round"/> <path d="M6.9 6.9L11.1 11.1M11.1 6.9L6.9 11.1" stroke="currentColor" stroke-width="1.44" stroke-linecap="round"/>`,
  },
  /*
   * A paperclip, on a 24 grid rather than the 18 the rest use, because the
   * curve of it is described that way everywhere — redrawn at 18 the two
   * bends land between pixels and it reads as a hook. The stroke is scaled to
   * match so it carries the same weight as its neighbours.
   */
  /* Two sheets, the back one offset: the one drawing everybody reads as
     "another of these". Lucide's shape, at the stroke the rest of the set
     uses. */
  copy: {
    vb: '0 0 24 24',
    body: `<rect x="9" y="9" width="12" height="12" rx="2.5" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/>`,
  },
  /* A bin, and the lid said separately so the two lines do not join into a
     shape that reads as a jar. */
  trash: {
    vb: '0 0 24 24',
    body: `<path d="M3.5 6h17M9 6V4.5A1.5 1.5 0 0 1 10.5 3h3A1.5 1.5 0 0 1 15 4.5V6m3 0v13.5A1.5 1.5 0 0 1 16.5 21h-9A1.5 1.5 0 0 1 6 19.5V6" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/><path d="M10 10.5v6M14 10.5v6" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/>`,
  },
  clip: {
    vb: '0 0 24 24',
    body: `<path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/>`,
  },
  statusOpen: {
    vb: '0 0 18 18',
    body: `<path d="M9 15.3C12.4794 15.3 15.3 12.4794 15.3 9C15.3 5.52061 12.4794 2.7 9 2.7C5.52061 2.7 2.7 5.52061 2.7 9C2.7 12.4794 5.52061 15.3 9 15.3Z" stroke="currentColor" stroke-width="1.44" stroke-linecap="round" stroke-linejoin="round"/>`,
  },
  /*
   * Not started and not picked up either: the same ring, drawn broken.
   *
   * Backlog and Todo are both before the work begins, so they cannot share
   * the empty ring — two lists with one mark is the fault the marks were
   * introduced to fix. The dash is struck on the same circle as every other
   * status, at 2 on 2.4, which is nine repeats round a circumference of
   * 39.6 and so meets itself rather than leaving a long gap at the top.
   */
  statusBacklog: {
    vb: '0 0 18 18',
    body: `<path d="M9 15.3C12.4794 15.3 15.3 12.4794 15.3 9C15.3 5.52061 12.4794 2.7 9 2.7C5.52061 2.7 2.7 5.52061 2.7 9C2.7 12.4794 5.52061 15.3 9 15.3Z" stroke="currentColor" stroke-width="1.44" stroke-linecap="round" stroke-dasharray="2 2.4"/>`,
  },
  updown: {
    vb: '0 0 14 14',
    body: `<path d="M4.9 5.6L7 3.5L9.1 5.6M4.9 8.4L7 10.5L9.1 8.4" stroke="currentColor" stroke-width="1.19" stroke-linecap="round" stroke-linejoin="round"/>`,
  },
  chevR: {
    vb: '0 0 14 14',
    body: `<path d="M5.6 3.5L9.1 7L5.6 10.5" stroke="currentColor" stroke-width="1.26" stroke-linecap="round" stroke-linejoin="round"/>`,
  },
  plusThin: {
    vb: '0 0 16 16',
    body: `<path d="M8 3.6V12.4M3.6 8H12.4" stroke="currentColor" stroke-width="1.44" stroke-linecap="round" stroke-linejoin="round"/>`,
  },
  /*
   * The plus turned forty-five degrees, and drawn to the same numbers.
   *
   * A cross and a plus are one shape in two orientations, so they share the
   * stroke and the reach: 1.44 and 8.8 across, which is what `plusThin`
   * uses. Drawn freehand it would be a second weight on screens that often
   * show both — the plus on a band and this on the panel over it.
   *
   * The ends are the diagonal of that same square: 3.6 and 12.4 are the
   * plus's own bounds, so the cross fills exactly the box the plus does
   * rather than the larger one a rotation would sweep.
   */
  close: {
    vb: '0 0 16 16',
    body: `<path d="M4.4 4.4L11.6 11.6M11.6 4.4L4.4 11.6" stroke="currentColor" stroke-width="1.44" stroke-linecap="round" stroke-linejoin="round"/>`,
  },
  chevL: {
    vb: '0 0 16 16',
    body: `<path d="M9.6 4L5.6 8L9.6 12" stroke="currentColor" stroke-width="1.52" stroke-linecap="round" stroke-linejoin="round"/>`,
  },
  /*
   * Narrow and open, as two arrows meeting or parting on a diagonal.
   *
   * A chevron says "there is more this way" — right for a band that folds
   * downward and wrong for a column that gives up its width: what happens
   * is the two sides coming together, and the way back is them parting.
   * The same pair every editor uses for full screen, which is the same
   * gesture.
   */
  shrink: {
    vb: '0 0 16 16',
    body:
      `<path d="M13.5 2.5L9.5 6.5M9.5 6.5V3.5M9.5 6.5H12.5" stroke="currentColor" stroke-width="1.52" stroke-linecap="round" stroke-linejoin="round"/>` +
      `<path d="M2.5 13.5L6.5 9.5M6.5 9.5V12.5M6.5 9.5H3.5" stroke="currentColor" stroke-width="1.52" stroke-linecap="round" stroke-linejoin="round"/>`,
  },
  grow: {
    vb: '0 0 16 16',
    body:
      `<path d="M9.5 6.5L13.5 2.5M13.5 2.5H10.5M13.5 2.5V5.5" stroke="currentColor" stroke-width="1.52" stroke-linecap="round" stroke-linejoin="round"/>` +
      `<path d="M6.5 9.5L2.5 13.5M2.5 13.5H5.5M2.5 13.5V10.5" stroke="currentColor" stroke-width="1.52" stroke-linecap="round" stroke-linejoin="round"/>`,
  },
  /* A window with a column down its left: the mark every desktop app puts
     on the control that folds a side column away and brings it back. */
  panel: {
    vb: '0 0 16 16',
    body:
      `<rect x="2.25" y="2.75" width="11.5" height="10.5" rx="2.25" stroke="currentColor" stroke-width="1.52"/>` +
      `<path d="M6.25 3V13" stroke="currentColor" stroke-width="1.52"/>`,
  },
  send: {
    vb: '0 0 28 28',
    body: `<path d="M14.0004 2.1C20.5724 2.10021 25.8998 7.42833 25.8998 14.0004C25.8996 20.5723 20.5723 25.8996 14.0004 25.8998C7.42833 25.8998 2.10021 20.5724 2.1 14.0004C2.1 7.4282 7.4282 2.1 14.0004 2.1ZM14.9398 7.45937C14.4532 6.97311 13.6838 6.9424 13.1615 7.36758L13.06 7.45937L8.29922 12.2201C7.78041 12.7394 7.78038 13.5807 8.29922 14.1C8.81862 14.6194 9.66166 14.6194 10.1811 14.1L12.6703 11.6098V20.0199C12.6704 20.7543 13.266 21.3499 14.0004 21.35C14.7346 21.3497 15.3294 20.7542 15.3295 20.0199V11.6098L17.8187 14.1C18.3381 14.6194 19.1812 14.6194 19.7006 14.1C20.2196 13.5807 20.2195 12.7394 19.7006 12.2201L14.9398 7.45937Z" fill="currentColor"/>`,
  },
  reply: {
    vb: '0 0 14 14',
    body: `<path d="M5.74 3.01L2.1 6.3L5.74 9.59C6.09 9.87 6.58 9.66 6.58 9.24V7.7C9.1 7.7 10.78 8.4 11.9 10.29C12.04 10.5 12.32 10.43 12.32 10.15C12.04 7.14 10.22 5.25 6.58 4.97V3.36C6.58 2.94 6.09 2.73 5.74 3.01Z" fill="currentColor"/>`,
  },
  folder: {
    vb: '0 0 16 16',
    body: `<path d="M1.6 4.2a1.8 1.8 0 0 1 1.8-1.8h2.2c.5 0 .97.2 1.3.56l.74.8h4.96a1.8 1.8 0 0 1 1.8 1.8v6.24a1.8 1.8 0 0 1-1.8 1.8H3.4a1.8 1.8 0 0 1-1.8-1.8V4.2Z" fill="currentColor"/>`,
  },
  /*
   * Three drawn by hand, because the design file has no theme switch in it.
   * Kept to the same stroke weight and 16-unit box as the ones it exports, so
   * they do not read as borrowed from somewhere else.
   */
  sun: {
    vb: '0 0 16 16',
    body: `<circle cx="8" cy="8" r="3.1" stroke="currentColor" stroke-width="1.4"/><path d="M8 1.6v1.5M8 12.9v1.5M14.4 8h-1.5M3.1 8H1.6M12.53 3.47l-1.06 1.06M4.53 11.47l-1.06 1.06M12.53 12.53l-1.06-1.06M4.53 4.53 3.47 3.47" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>`,
  },
  /* A label: the tag it is named after, with its hole. Line, at the
     weight of the sun and the moon. */
  tag: {
    vb: '0 0 16 16',
    body: `<path d="M2.6 3.4v3.9c0 .4.16.78.44 1.06l5.4 5.4a1.5 1.5 0 0 0 2.12 0l3.2-3.2a1.5 1.5 0 0 0 0-2.12l-5.4-5.4A1.5 1.5 0 0 0 7.3 2.6H3.4a.8.8 0 0 0-.8.8Z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/><circle cx="5.6" cy="5.6" r="1.1" fill="currentColor"/>`,
  },
  /* A sprint: a stretch of time with part of it gone — a ring with its
     first wedge filled, as Linear draws a cycle. It was two arrows round,
     which beside Repeat's loop on the task's screen read as the same
     thing twice. Not the clock — that is the feed's. */
  cycle: {
    vb: '0 0 16 16',
    body: `<circle cx="8" cy="8" r="5.8" stroke="currentColor" stroke-width="1.4" fill="none"/><path d="M8 8V4.4a3.6 3.6 0 0 1 2.55 6.15Z" fill="currentColor"/>`,
  },
  /* A task that repeats: a loop with an arrow at each end, the mark every
     calendar and to-do app draws for it — not the sprint's ring, which is a
     stretch of dates. */
  repeat: {
    vb: '0 0 16 16',
    body: `<path d="M2.8 7.4V6.6a2.2 2.2 0 0 1 2.2-2.2h7.6M10.6 2.4l2 2-2 2M13.2 8.6v.8a2.2 2.2 0 0 1-2.2 2.2H3.4M5.4 13.6l-2-2 2-2" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`,
  },
  /* No connection: the cloud the data is in, struck through. Drawn in
     line at the weight of the sun and the moon, its neighbours in the bar. */
  offline: {
    vb: '0 0 16 16',
    body: `<path d="M4.7 12.5h6.5a2.8 2.8 0 0 0 .6-5.53A3.9 3.9 0 0 0 4.4 5.7a3.4 3.4 0 0 0 .3 6.8Z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/><path d="m2.4 2.4 11.2 11.2" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>`,
  },
  moon: {
    vb: '0 0 16 16',
    body: `<path d="M13.2 9.6A5.8 5.8 0 0 1 6.4 2.8a5.8 5.8 0 1 0 6.8 6.8Z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/>`,
  },
  /*
   * A page with a pencil on it: make something, anywhere in the product.
   * Drawn here too — the design file has no global create, because until now
   * there was nothing global to draw.
   */
  compose: {
    vb: '0 0 16 16',
    body: `<path d="M13.4 9.4v3a1.8 1.8 0 0 1-1.8 1.8H3.6a1.8 1.8 0 0 1-1.8-1.8V4.4a1.8 1.8 0 0 1 1.8-1.8h3" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/><path d="M11.2 2.1 13.9 4.8 8.2 10.5H5.5V7.8z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/>`,
  },
  /*
   * Two faders with a knob on each: how this is being looked at.
   *
   * It was the list glyph, which is the picture of the thing being looked
   * at rather than of the looking — and it sat beside a switch that draws
   * the same list as a board, where it was simply wrong. Faders say
   * "settings for what is in front of you" and say nothing about the shape
   * it is drawn in.
   */
  sliders: {
    vb: '0 0 16 16',
    body: `<path d="M2.2 5.4h5.2M12.2 5.4h1.6M2.2 10.6h1.6M8.6 10.6h5.2" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/><circle cx="9.8" cy="5.4" r="1.8" stroke="currentColor" stroke-width="1.4"/><circle cx="6.2" cy="10.6" r="1.8" stroke="currentColor" stroke-width="1.4"/>`,
  },
  /* Half filled: the machine decides, and it may decide either way. */
  /* A stopwatch, for time logged against a task — beside the history's
     clock-with-an-arrow, and not to be confused with it. */
  clock: {
    vb: '0 0 16 16',
    body: `<circle cx="8" cy="9" r="5.3" stroke="currentColor" stroke-width="1.44"/><path d="M8 6.4V9l1.8 1.2M6.4 1.8h3.2" stroke="currentColor" stroke-width="1.44" stroke-linecap="round" stroke-linejoin="round"/>`,
  },
  /* An hourglass: a task waiting on another.
     Filled, by decision, so the mark reads at card size. */
  wait: {
    vb: '0 0 16 16',
    body: `<rect x="3.6" y="1.6" width="8.8" height="1.6" rx="0.8" fill="currentColor"/><rect x="3.6" y="12.8" width="8.8" height="1.6" rx="0.8" fill="currentColor"/><path d="M4.8 3.2h6.4v.8c0 1.6-1.2 2.8-2.4 4 1.2 1.2 2.4 2.4 2.4 4v.8H4.8V12c0-1.6 1.2-2.8 2.4-4-1.2-1.2-2.4-2.4-2.4-4v-.8Z" fill="currentColor"/>`,
  },
  /* The chat composer's own: the type toggle, a face for emoji, an at. */
  type: {
    vb: '0 0 16 16',
    body: `<path d="M2 12.5l3.2-9 3.2 9M3.2 9.5h4" stroke="currentColor" stroke-width="1.44" stroke-linecap="round" stroke-linejoin="round"/><path d="M10 12.5h4.5" stroke="currentColor" stroke-width="1.44" stroke-linecap="round"/><path d="M13.8 10.6a1.7 1.7 0 1 1-3.4 0v-1a1.7 1.7 0 1 1 3.4 0v2.9" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>`,
  },
  smile: {
    vb: '0 0 16 16',
    body: `<circle cx="8" cy="8" r="6" stroke="currentColor" stroke-width="1.44"/><path d="M5.6 9.6a3 3 0 0 0 4.8 0" stroke="currentColor" stroke-width="1.44" stroke-linecap="round"/><circle cx="6" cy="6.6" r=".9" fill="currentColor"/><circle cx="10" cy="6.6" r=".9" fill="currentColor"/>`,
  },
  at: {
    vb: '0 0 16 16',
    body: `<circle cx="8" cy="8" r="2.6" stroke="currentColor" stroke-width="1.44"/><path d="M10.6 8v1.2a1.9 1.9 0 0 0 3.8 0V8A6.4 6.4 0 1 0 11 13.6" stroke="currentColor" stroke-width="1.44" stroke-linecap="round"/>`,
  },
  /* Lines going into a pointer: a task handed to an agent. */
  prompt: {
    vb: '0 0 16 16',
    body: `<path d="M2.5 4h8M2.5 7.5h5M2.5 11h3.5" stroke="currentColor" stroke-width="1.44" stroke-linecap="round"/><path d="M9.5 8.5l4.5 1.7-2 .8-.8 2-1.7-4.5z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/>`,
  },
  /* The editor's own marks — drawn on the 16 box at the close glyph's
     weight, so they sit beside it without looking borrowed. */
  /* GitHub's own mark, as GitHub draws it for the places that name it.
     Not one of ours, and not altered. */
  github: {
    vb: '0 0 16 16',
    body: `<path fill-rule="evenodd" d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" fill="currentColor"/>`,
  },
  /* A pull request as GitHub marks one — open, merged, closed without
     merging, draft. Octicons, GitHub's own drawings, not altered, so the
     shape says the state to anybody who reads GitHub; filled even-odd so
     the rings stay rings. */
  pullOpen: {
    vb: '0 0 16 16',
    body: `<path fill-rule="evenodd" d="M1.5 3.25a2.25 2.25 0 1 1 3 2.122v5.256a2.251 2.251 0 1 1-1.5 0V5.372A2.25 2.25 0 0 1 1.5 3.25Zm5.677-.177L9.573.677A.25.25 0 0 1 10 .854V2.5h1A2.5 2.5 0 0 1 13.5 5v5.628a2.251 2.251 0 1 1-1.5 0V5a1 1 0 0 0-1-1h-1v1.646a.25.25 0 0 1-.427.177L7.177 3.427a.25.25 0 0 1 0-.354ZM3.75 2.5a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Zm0 9.5a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Zm8.25.75a.75.75 0 1 0 1.5 0 .75.75 0 0 0-1.5 0Z" fill="currentColor"/>`,
  },
  pullMerged: {
    vb: '0 0 16 16',
    body: `<path fill-rule="evenodd" d="M5.45 5.154A4.25 4.25 0 0 0 9.25 7.5h1.378a2.251 2.251 0 1 1 0 1.5H9.25A5.734 5.734 0 0 1 5 7.123v3.505a2.25 2.25 0 1 1-1.5 0V5.372a2.25 2.25 0 1 1 1.95-.218ZM4.25 13.5a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Zm8.5-4.5a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5ZM4.25 4a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Z" fill="currentColor"/>`,
  },
  pullClosed: {
    vb: '0 0 16 16',
    body: `<path fill-rule="evenodd" d="M3.25 1A2.25 2.25 0 0 1 4 5.372v5.256a2.251 2.251 0 1 1-1.5 0V5.372A2.251 2.251 0 0 1 3.25 1Zm9.5 5.5a.75.75 0 0 1 .75.75v3.378a2.251 2.251 0 1 1-1.5 0V7.25a.75.75 0 0 1 .75-.75Zm-2.03-5.273a.75.75 0 0 1 1.06 0l.97.97.97-.97a.748.748 0 0 1 1.265.332.75.75 0 0 1-.205.729l-.97.97.97.97a.751.751 0 0 1-.018 1.042.751.751 0 0 1-1.042.018l-.97-.97-.97.97a.749.749 0 0 1-1.275-.326.749.749 0 0 1 .215-.734l.97-.97-.97-.97a.75.75 0 0 1 0-1.06ZM2.5 3.25a.75.75 0 1 0 1.5 0 .75.75 0 0 0-1.5 0ZM3.25 12a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Zm9.5 0a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Z" fill="currentColor"/>`,
  },
  pullDraft: {
    vb: '0 0 16 16',
    body: `<path fill-rule="evenodd" d="M3.25 1A2.25 2.25 0 0 1 4 5.372v5.256a2.251 2.251 0 1 1-1.5 0V5.372A2.251 2.251 0 0 1 3.25 1Zm9.5 14a2.25 2.25 0 1 1 0-4.5 2.25 2.25 0 0 1 0 4.5ZM2.5 3.25a.75.75 0 1 0 1.5 0 .75.75 0 0 0-1.5 0ZM3.25 12a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Zm9.5 0a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5ZM14 7.5a1.25 1.25 0 1 1-2.5 0 1.25 1.25 0 0 1 2.5 0Zm0-4.25a1.25 1.25 0 1 1-2.5 0 1.25 1.25 0 0 1 2.5 0Z" fill="currentColor"/>`,
  },
  /* Slack's own mark, in its four colours, as Slack draws it for the
     places that name it. Not one of ours, and not
     altered; the colours are its, not the theme's. */
  slack: {
    vb: '0 0 54 54',
    body: `<path d="M19.712.133a5.381 5.381 0 0 0-5.376 5.387 5.381 5.381 0 0 0 5.376 5.386h5.376V5.52A5.381 5.381 0 0 0 19.712.133m0 14.365H5.376A5.381 5.381 0 0 0 0 19.884a5.381 5.381 0 0 0 5.376 5.387h14.336a5.381 5.381 0 0 0 5.376-5.387 5.381 5.381 0 0 0-5.376-5.386" fill="#36C5F0"/><path d="M53.76 19.884a5.381 5.381 0 0 0-5.376-5.386 5.381 5.381 0 0 0-5.376 5.386v5.387h5.376a5.381 5.381 0 0 0 5.376-5.387m-14.336 0V5.52A5.381 5.381 0 0 0 34.048.133a5.381 5.381 0 0 0-5.376 5.387v14.364a5.381 5.381 0 0 0 5.376 5.387 5.381 5.381 0 0 0 5.376-5.387" fill="#2EB67D"/><path d="M34.048 54a5.381 5.381 0 0 0 5.376-5.387 5.381 5.381 0 0 0-5.376-5.386h-5.376v5.386A5.381 5.381 0 0 0 34.048 54m0-14.365h14.336a5.381 5.381 0 0 0 5.376-5.386 5.381 5.381 0 0 0-5.376-5.387H34.048a5.381 5.381 0 0 0-5.376 5.387 5.381 5.381 0 0 0 5.376 5.386" fill="#ECB22E"/><path d="M0 34.249a5.381 5.381 0 0 0 5.376 5.386 5.381 5.381 0 0 0 5.376-5.386v-5.387H5.376A5.381 5.381 0 0 0 0 34.25m14.336-.001v14.364A5.381 5.381 0 0 0 19.712 54a5.381 5.381 0 0 0 5.376-5.387V34.25a5.381 5.381 0 0 0-5.376-5.387 5.381 5.381 0 0 0-5.376 5.387" fill="#E01E5A"/>`,
  },
  link: {
    vb: '0 0 16 16',
    body: `<path d="M6.9 9.1a2.6 2.6 0 0 0 3.7 0l2.2-2.2a2.6 2.6 0 0 0-3.7-3.7l-.8.8" stroke="currentColor" stroke-width="1.44" stroke-linecap="round" stroke-linejoin="round"/><path d="M9.1 6.9a2.6 2.6 0 0 0-3.7 0L3.2 9.1a2.6 2.6 0 0 0 3.7 3.7l.8-.8" stroke="currentColor" stroke-width="1.44" stroke-linecap="round" stroke-linejoin="round"/>`,
  },
  /* Leaving for another address: an arrow up and out of the corner — a
     door the host keeps shut, opened at usetuff.com (`custom-domain.md`). */
  away: {
    vb: '0 0 16 16',
    body: `<path d="M5.5 10.5 11 5M6.25 4.75H11.25V9.75" stroke="currentColor" stroke-width="1.44" stroke-linecap="round" stroke-linejoin="round"/>`,
  },
  /* A table: a frame, its header line and one column rule. */
  table: {
    vb: '0 0 16 16',
    body: `<rect x="2.25" y="2.75" width="11.5" height="10.5" rx="2" stroke="currentColor" stroke-width="1.44" fill="none"/><path d="M2.25 6.5h11.5M6.25 6.5v6.75" stroke="currentColor" stroke-width="1.44"/>`,
  },
  /* A picture: its frame, the sun and a hill — the Images kind in Files,
     drawn to the table's numbers, the frame it stands beside. */
  image: {
    vb: '0 0 16 16',
    body: `<rect x="2.25" y="2.75" width="11.5" height="10.5" rx="2" stroke="currentColor" stroke-width="1.44" fill="none"/><circle cx="10.4" cy="6.1" r="1.3" fill="currentColor"/><path d="M2.6 12.4 6 8.9a.8.8 0 0 1 1.15 0l2.35 2.4 1.05-1.05a.8.8 0 0 1 1.13 0l1.92 1.92" stroke="currentColor" stroke-width="1.44" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`,
  },
  rule: {
    vb: '0 0 16 16',
    body: `<path d="M2.5 8h11" stroke="currentColor" stroke-width="1.44" stroke-linecap="round"/>`,
  },
  quote: {
    vb: '0 0 16 16',
    body: `<path d="M3.5 3v10" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M7 5h6M7 8h6M7 11h4" stroke="currentColor" stroke-width="1.44" stroke-linecap="round"/>`,
  },
  /* A toggle: the turned arrow, its line, and the body under it — drawn
     to the quote's numbers, which it sits beside in the block list. */
  toggle: {
    vb: '0 0 16 16',
    body: `<path d="M3 3.75L6 6L3 8.25Z" fill="currentColor" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/><path d="M8.5 6h4.5M8.5 10.5h3" stroke="currentColor" stroke-width="1.44" stroke-linecap="round"/>`,
  },
  code: {
    vb: '0 0 16 16',
    body: `<path d="M5.5 4.5L2 8l3.5 3.5M10.5 4.5L14 8l-3.5 3.5" stroke="currentColor" stroke-width="1.44" stroke-linecap="round" stroke-linejoin="round"/>`,
  },
  upload: {
    vb: '0 0 16 16',
    body: `<path d="M8 10V3m0 0 3 3M8 3 5 6M3.5 12.5h9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>`,
  },
  download: {
    vb: '0 0 16 16',
    body: `<path d="M8 2.5v7m0 0 3-3m-3 3-3-3M3.5 12.5h9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>`,
  },
  contrast: {
    vb: '0 0 16 16',
    body: `<circle cx="8" cy="8" r="5.8" stroke="currentColor" stroke-width="1.4"/><path d="M8 2.2a5.8 5.8 0 0 1 0 11.6Z" fill="currentColor"/>`,
  },
  /* A pushpin: kept at the head of a list — `docs/specs/docs.md`. */
  pin: {
    vb: '0 0 16 16',
    body: `<path d="M9.8 2.2 13.8 6.2M10.9 3.3 6.6 6.2 4.2 6.4 9.6 11.8 9.8 9.4 12.7 5.1M6.9 9.1 2.6 13.4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`,
  },
  /* A tick, for the one chosen in a short list. */
  check: {
    vb: '0 0 16 16',
    body: `<path d="M3.4 8.4 6.6 11.6 12.8 4.6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`,
  },
  /* The bell with a line through it: a room told to say nothing. */
  bellOff: {
    vb: '0 0 18 18',
    body: `<path d="M9 2.25c2.7 0 4.5 2.07 4.5 4.68v3.24l1.35 1.98c.36.54 0 1.17-.63 1.17H3.78c-.63 0-.99-.63-.63-1.17L4.5 10.17V6.93C4.5 4.32 6.3 2.25 9 2.25Z" stroke="currentColor" stroke-width="1.4" fill="none"/><path d="M7.02 14.4h3.96a1.98 1.98 0 0 1-3.96 0Z" fill="currentColor"/><path d="M2.6 2.6l12.8 12.8" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>`,
  },
  /* Seen, and put away: a room shown in the list or hidden under More chats
     — `docs/specs/sidebar-hide.md`. */
  eye: {
    vb: '0 0 16 16',
    body: `<path d="M1.6 8s2.4-4.6 6.4-4.6S14.4 8 14.4 8s-2.4 4.6-6.4 4.6S1.6 8 1.6 8Z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round" fill="none"/><circle cx="8" cy="8" r="2" stroke="currentColor" stroke-width="1.4" fill="none"/>`,
  },
  eyeOff: {
    vb: '0 0 16 16',
    body: `<path d="M6.3 3.6c.5-.1 1.1-.2 1.7-.2 4 0 6.4 4.6 6.4 4.6s-.7 1.3-1.9 2.5M10 12.1c-.6.3-1.3.5-2 .5-4 0-6.4-4.6-6.4-4.6s.9-1.7 2.5-3.1M6.6 6.6a2 2 0 0 0 2.8 2.8" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" fill="none"/><path d="M2.4 2.4l11.2 11.2" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>`,
  },
  /* Kept to some people — a document of chosen people or a draft,
     Filled, as the person is. */
  lock: {
    vb: '0 0 16 16',
    body: `<path d="M5 7V5.2a3 3 0 0 1 6 0V7" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" fill="none"/><rect x="3" y="7" width="10" height="7.2" rx="1.6" fill="currentColor"/>`,
  },
  /* A channel, as Slack draws one. */
  hash: {
    vb: '0 0 16 16',
    body: `<path d="M6.4 2.4 5 13.6M11 2.4 9.6 13.6M2.8 5.8h11M2.2 10.2h11" stroke="currentColor" stroke-width="1.44" stroke-linecap="round"/>`,
  },
  /*
   * What a project can be about. Drawn by
   * hand in the 16-unit box, filled, as the folder and the board are: the
   * marks a project wore were the product's own glyphs — a document, a
   * list, a paper clip — and none of them said what a project was for.
   */
  rocket: {
    vb: '0 0 16 16',
    body: `<path fill-rule="evenodd" d="M8 1.4c2.3 1.3 3.7 3.8 3.7 6.6v1.7l1.5 1.4c.2.2.3.4.3.7v1.8c0 .4-.4.7-.8.5l-2.1-.9H5.4l-2.1.9c-.4.2-.8-.1-.8-.5v-1.8c0-.3.1-.5.3-.7l1.5-1.4V8c0-2.8 1.4-5.3 3.7-6.6ZM8 5.1a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Z" fill="currentColor"/><path d="M6.7 13.4h2.6l-.9 1.5a.45.45 0 0 1-.8 0Z" fill="currentColor"/>`,
  },
  briefcase: {
    vb: '0 0 16 16',
    body: `<path fill-rule="evenodd" d="M5.4 3.6A1.6 1.6 0 0 1 7 2h2a1.6 1.6 0 0 1 1.6 1.6V4h1.9A1.5 1.5 0 0 1 14 5.5v6a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 2 11.5v-6A1.5 1.5 0 0 1 3.5 4h1.9v-.4Zm1.3.4h2.6v-.4a.3.3 0 0 0-.3-.3H7a.3.3 0 0 0-.3.3V4Z" fill="currentColor"/>`,
  },

  palette: {
    vb: '0 0 16 16',
    body: `<path fill-rule="evenodd" d="M8 1.8a6.2 6.2 0 0 0 0 12.4c.9 0 1.5-.6 1.5-1.4 0-.4-.2-.7-.4-1-.2-.3-.4-.6-.4-1 0-.7.6-1.3 1.3-1.3h1.5a2.8 2.8 0 0 0 2.7-2.8C14.2 4 11.4 1.8 8 1.8ZM4.9 7a1.05 1.05 0 1 0 0 2.1 1.05 1.05 0 0 0 0-2.1Zm1.7-2.9a1.05 1.05 0 1 0 0 2.1 1.05 1.05 0 0 0 0-2.1Zm3.1 0a1.05 1.05 0 1 0 0 2.1 1.05 1.05 0 0 0 0-2.1Z" fill="currentColor"/>`,
  },
  camera: {
    vb: '0 0 16 16',
    body: `<path fill-rule="evenodd" d="M5.6 3.1c.2-.4.6-.6 1-.6h2.8c.4 0 .8.2 1 .6l.5.9h1.6A1.5 1.5 0 0 1 14 5.5v6a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 2 11.5v-6A1.5 1.5 0 0 1 3.5 4h1.6l.5-.9ZM8 5.9a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5Z" fill="currentColor"/>`,
  },
  book: {
    vb: '0 0 16 16',
    body: `<path d="M1.8 3.5c0-.4.3-.7.7-.7 2 0 3.7.5 4.8 1.4v9.1c-1.2-.8-2.9-1.2-4.8-1.2a.7.7 0 0 1-.7-.7V3.5Zm12.4 0c0-.4-.3-.7-.7-.7-2 0-3.7.5-4.8 1.4v9.1c1.2-.8 2.9-1.2 4.8-1.2.4 0 .7-.3.7-.7V3.5Z" fill="currentColor"/>`,
  },
  chart: {
    vb: '0 0 16 16',
    body: `<rect x="2.2" y="8.2" width="2.8" height="5.6" rx="0.9" fill="currentColor"/><rect x="6.6" y="4.8" width="2.8" height="9" rx="0.9" fill="currentColor"/><rect x="11" y="2.2" width="2.8" height="11.6" rx="0.9" fill="currentColor"/>`,
  },
  target: {
    vb: '0 0 16 16',
    body: `<path fill-rule="evenodd" d="M8 1.8a6.2 6.2 0 1 0 0 12.4A6.2 6.2 0 0 0 8 1.8Zm0 1.6a4.6 4.6 0 1 1 0 9.2 4.6 4.6 0 0 1 0-9.2ZM8 5a3 3 0 1 0 0 6 3 3 0 0 0 0-6Zm0 1.6a1.4 1.4 0 1 1 0 2.8 1.4 1.4 0 0 1 0-2.8Z" fill="currentColor"/>`,
  },
  bolt: {
    vb: '0 0 16 16',
    body: `<path d="M9.3 1.8 3.6 9.1h4.1l-.9 5.1 5.6-7.3H8.4l.9-5.1Z" fill="currentColor" stroke="currentColor" stroke-width="1" stroke-linejoin="round"/>`,
  },
  star: {
    vb: '0 0 16 16',
    body: `<path d="M8 2l1.8 3.75 4.1.55-3 2.85.75 4.05L8 11.2l-3.65 2 .75-4.05-3-2.85 4.1-.55L8 2Z" fill="currentColor" stroke="currentColor" stroke-width="1" stroke-linejoin="round"/>`,
  },
  heart: {
    vb: '0 0 16 16',
    body: `<path d="M8 13.6C5.2 11.9 2.2 9.5 2.2 6.3A3.1 3.1 0 0 1 8 4.8a3.1 3.1 0 0 1 5.8 1.5c0 3.2-3 5.6-5.8 7.3Z" fill="currentColor"/>`,
  },
  home: {
    vb: '0 0 16 16',
    body: `<path d="M7.3 2.2a1 1 0 0 1 1.4 0l5 4.5c.2.2.3.5.3.8v5.5a1 1 0 0 1-1 1H10.2V10.6a2.2 2.2 0 0 0-4.4 0V14H3a1 1 0 0 1-1-1V7.5c0-.3.1-.6.3-.8l5-4.5Z" fill="currentColor"/>`,
  },
  bag: {
    vb: '0 0 16 16',
    body: `<path fill-rule="evenodd" d="M5 5.1v-.6a3 3 0 0 1 6 0v.6h1.3c.5 0 .9.4 1 .9l.6 6.5A1.4 1.4 0 0 1 12.5 14h-9a1.4 1.4 0 0 1-1.4-1.5L2.7 6c.1-.5.5-.9 1-.9H5Zm1.4 0h3.2v-.6a1.6 1.6 0 0 0-3.2 0v.6Z" fill="currentColor"/>`,
  },
  leaf: {
    vb: '0 0 16 16',
    body: `<path d="M13.8 2.2C7.2 2.2 3.1 5.3 3.1 9.8c0 1 .2 1.8.6 2.5l-1.4 1.4.9.9 1.4-1.4c.7.4 1.6.6 2.5.6 4.5 0 6.7-4.4 6.7-11.6Z" fill="currentColor"/>`,
  },
  music: {
    vb: '0 0 16 16',
    body: `<path d="M13.2 2.3v8.4a2.2 2.2 0 1 1-1.4-2.05V5.2L6.6 6.4v5.8a2.2 2.2 0 1 1-1.4-2.05V4.5c0-.35.25-.65.55-.7l6.8-1.6c.35-.1.65.15.65.5Z" fill="currentColor"/>`,
  },
} satisfies Record<string, { vb: string; body: string }>

export type IconName = keyof typeof SHAPES

/**
 * One box, whatever the glyph's own proportion.
 *
 * The chevron is 6×9 and the ellipsis 11×2 in the file they came from. Given
 * `width={size} height={size}` they would stretch; given their own numbers
 * they would not line up with the 16 and 18 boxes everything else sits in.
 * The viewBox keeps the drawing and the box keeps the alignment.
 */
/** A glyph as markup, for what draws outside React — an editor's node. */
export function glyphMarkup(name: IconName, size: number): string {
  const shape = SHAPES[name]!
  const [, , w, h] = shape.vb.split(' ').map(Number) as [number, number, number, number]
  const scale = size / Math.max(w, h)
  return `<svg width="${w * scale}" height="${h * scale}" viewBox="${shape.vb}" fill="none" aria-hidden="true">${shape.body}</svg>`
}

export function Icon({ name, size = 18, tone = 'inherit', style, className }: Props & { name: IconName }) {
  const shape = SHAPES[name]!
  const [, , w, h] = shape.vb.split(' ').map(Number) as [number, number, number, number]
  const scale = size / Math.max(w, h)
  return (
    <svg
      width={w * scale}
      height={h * scale}
      viewBox={shape.vb}
      fill="none"
      aria-hidden
      className={className}
      style={{ flexShrink: 0, display: 'block', color: TONE[tone], ...style }}
      dangerouslySetInnerHTML={{ __html: shape.body }}
    />
  )
}

/**
 * Study site: light and dark pages.
 *
 * The theme is the `dark` class on <html>. The inline script at the top of
 * BaseLayout's <head> sets it before the first paint: a choice saved in
 * localStorage (`theme` = `dark` or `light`) wins, otherwise the OS setting
 * decides. After that, everything that changes the theme goes through
 * setTheme() here (the header's toggle, the command palette's quick action, any
 * [data-theme-toggle] button), which fires `themechange` on window with
 * { detail: { dark } } so figures and diagrams can redraw.
 *
 * The colours are CSS variables in src/styles/roadmap.css (`:root` and
 * `:root.dark`). Figures that mix colours in script read them with cssColor()
 * at draw time.
 */

export type Theme = 'dark' | 'light';
const KEY = 'theme';

export const isDark = () => document.documentElement.classList.contains('dark');

export function savedTheme(): Theme | null {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'dark' || v === 'light' ? v : null;
  } catch {
    return null;
  }
}

const systemTheme = (): Theme => (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');

function apply(theme: Theme) {
  const dark = theme === 'dark';
  if (isDark() === dark) return;
  document.documentElement.classList.toggle('dark', dark);
  window.dispatchEvent(new CustomEvent('themechange', { detail: { dark } }));
}

/** Switch to a theme and remember it, so it wins over the OS setting from now on. */
export function setTheme(theme: Theme) {
  try {
    localStorage.setItem(KEY, theme);
  } catch {
    /* private mode: the choice lasts for this page only */
  }
  apply(theme);
}

export const toggleTheme = () => setTheme(isDark() ? 'light' : 'dark');

/**
 * Keep the page in step while it is open: follow the OS setting until the
 * reader chooses, and follow a choice made in another tab. Call once per page.
 */
export function watchTheme() {
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (!savedTheme()) apply(systemTheme());
  });
  window.addEventListener('storage', (e) => {
    if (e.key === KEY || e.key === null) apply(savedTheme() ?? systemTheme());
  });
}

/** Call fn(dark) whenever the theme changes. */
export function onThemeChange(fn: (dark: boolean) => void) {
  window.addEventListener('themechange', (e) => fn(Boolean((e as CustomEvent<{ dark: boolean }>).detail?.dark)));
}

let ctx: CanvasRenderingContext2D | null = null;

/** A CSS colour variable as [r, g, b], read from el (default <html>) at the moment of calling. */
export function cssColor(name: string, el: Element = document.documentElement): [number, number, number] {
  const value = getComputedStyle(el).getPropertyValue(name).trim();
  ctx ??= document.createElement('canvas').getContext('2d');
  if (!ctx || !value) return [0, 0, 0];
  ctx.fillStyle = '#000';
  ctx.fillStyle = value;
  const s = String(ctx.fillStyle); // '#rrggbb', or 'rgba(r, g, b, a)' for a translucent colour
  if (s.startsWith('#')) return [1, 3, 5].map((i) => parseInt(s.slice(i, i + 2), 16)) as [number, number, number];
  const [r, g, b] = (s.match(/[\d.]+/g) || ['0', '0', '0']).map(Number);
  return [r, g, b];
}

/** The same colour as a '#rrggbb' string (for libraries that want hex, like mermaid). */
export const cssHex = (name: string, el?: Element) => '#' + cssColor(name, el).map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');

/**
 * The value shading of the grid figures: from the board colour (--box) toward
 * --shade-good for v > 0 or --shade-bad for v < 0, as far as |v| * 0.55.
 * The colours are read now, so make a new one after a theme change.
 */
export function valueShader(el: Element) {
  const from = cssColor('--box', el), good = cssColor('--shade-good', el), bad = cssColor('--shade-bad', el);
  return (v: number) => {
    const t = Math.max(-1, Math.min(1, v));
    const to = t >= 0 ? good : bad;
    const m = Math.abs(t) * 0.55;
    return `rgb(${Math.round(from[0] + (to[0] - from[0]) * m)} ${Math.round(from[1] + (to[1] - from[1]) * m)} ${Math.round(from[2] + (to[2] - from[2]) * m)})`;
  };
}

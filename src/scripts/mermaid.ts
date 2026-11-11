/**
 * Study site: mermaid diagrams (the /diagrams/ page), drawn in the browser from
 * their source and drawn again when the theme changes.
 *
 * Light pages use mermaid's default theme, as before. Dark pages use its base
 * theme with the site's dark palette (the CSS variables in roadmap.css), and the
 * pastel fills the diagrams set themselves (`style S fill:#e1f5ff`) become dark
 * tints of the same hue, so the light text on them stays readable.
 */
import { cssHex, isDark, onThemeChange } from './theme';

const MERMAID = 'https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.esm.min.mjs';
const TRACKS = ['classical', 'rlhf', 'rlvr', 'rlaif', 'systems', 'agentic', 'foundations', 'offline'];

type RGB = [number, number, number];
const toRgb = (hex: string): RGB => {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as RGB;
};
const toHex = (c: number[]) => '#' + c.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');
const mix = (a: string, b: string, m: number) => { const A = toRgb(a), B = toRgb(b); return toHex(A.map((v, i) => v + (B[i] - v) * m)); };
const luminance = ([r, g, b]: RGB) => (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;

function hsl([r, g, b]: RGB): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min, s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
}
function fromHsl(h: number, s: number, l: number) {
  const k = (n: number) => (n + h / 30) % 12, a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
  return toHex([f(0) * 255, f(8) * 255, f(4) * 255]);
}

function config() {
  const base = { startOnLoad: false, securityLevel: 'loose', fontFamily: 'inherit' };
  if (!isDark()) return { ...base, theme: 'default' };
  const c = (name: string) => cssHex(name);
  const box = c('--box'), paper = c('--paper'), deep = c('--paper-deep'), ink = c('--ink'), soft = c('--ink-soft'), muted = c('--muted'), rule = c('--rule');
  // Timeline sections: dark tints of the track pencils, with ink on them.
  const scale: Record<string, string> = {};
  for (let i = 0; i < 12; i++) {
    scale[`cScale${i}`] = mix(box, c(`--c-${TRACKS[i % TRACKS.length]}`), 0.3);
    scale[`cScaleLabel${i}`] = ink;
    scale[`cScalePeer${i}`] = muted;
  }
  return {
    ...base,
    theme: 'base',
    themeVariables: {
      darkMode: true,
      fontFamily: 'inherit',
      background: paper,
      primaryColor: box, primaryTextColor: ink, primaryBorderColor: muted,
      secondaryColor: deep, secondaryTextColor: ink, secondaryBorderColor: muted,
      tertiaryColor: deep, tertiaryTextColor: ink, tertiaryBorderColor: muted,
      mainBkg: box, nodeBorder: muted, nodeTextColor: ink, textColor: ink, titleColor: ink,
      lineColor: soft, clusterBkg: deep, clusterBorder: rule, edgeLabelBackground: paper,
      ...scale,
    },
  };
}

// In the dark, a light fill a diagram sets on a node becomes a dark tint of the
// same hue, and a bright stroke a softer one.
function darken(svg: SVGSVGElement) {
  svg.querySelectorAll<SVGElement>('[style*="fill"], [style*="stroke"]').forEach((el) => {
    const style = el.getAttribute('style') || '';
    const next = style
      .replace(/fill:\s*(#[0-9a-f]{3,6})\b/gi, (m, hex) => {
        const rgb = toRgb(hex);
        if (luminance(rgb) < 0.5) return m;
        const [h, s] = hsl(rgb);
        return `fill:${fromHsl(h, Math.min(s, 0.32), 0.24)}`;
      })
      .replace(/stroke:\s*(#[0-9a-f]{3,6})\b/gi, (m, hex) => {
        const [h, s, l] = hsl(toRgb(hex));
        if (s < 0.6 || l < 0.3) return m;
        return `stroke:${fromHsl(h, 0.5, 0.62)}`;
      });
    if (next !== style) el.setAttribute('style', next);
  });
}

export async function renderMermaid() {
  const nodes = [...document.querySelectorAll<HTMLElement>('.mermaid')];
  if (!nodes.length) return;
  // Keep each diagram's source, to draw it again after a theme change.
  nodes.forEach((n) => { if (n.dataset.original === undefined) n.dataset.original = n.innerHTML; });
  // @ts-ignore - loaded from the CDN at run time
  const { default: mermaid } = await import(/* @vite-ignore */ MERMAID);

  let drawing = Promise.resolve();
  const draw = () => {
    drawing = drawing.then(async () => {
      mermaid.initialize(config());
      for (const n of nodes) {
        if (n.querySelector('svg')) n.innerHTML = n.dataset.original ?? '';
        n.removeAttribute('data-processed');
      }
      await mermaid.run({ nodes });
      if (isDark()) nodes.forEach((n) => { const svg = n.querySelector('svg'); if (svg) darken(svg); });
    }).catch((e) => console.warn('mermaid:', e));
    return drawing;
  };
  await draw();
  onThemeChange(() => { draw(); });
}

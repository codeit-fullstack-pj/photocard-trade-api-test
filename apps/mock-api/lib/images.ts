import type { Category } from "./traits";

function hash(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function palette(seed: string, category: Category): string[] {
  const base = category === "DOG" ? 25 : 265;
  const h = hash(seed);
  return [0, 1, 2, 3, 4].map(
    (i) => `hsl(${(base + ((h >> (i * 5)) % 40)) % 360} ${55 + ((h >> i) % 30)}% ${38 + i * 11}%)`,
  );
}

export function originalSvg(seed: string, category: Category, title: string): string {
  const [c0, c1, , c3, c4] = palette(seed, category);
  const emoji = category === "DOG" ? "🐶" : "🐱";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="480" viewBox="0 0 480 480">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c4}"/><stop offset="1" stop-color="${c1}"/></linearGradient></defs>
<rect width="480" height="480" fill="url(#g)"/>
<circle cx="240" cy="210" r="120" fill="${c3}" opacity="0.55"/>
<text x="240" y="258" font-size="150" text-anchor="middle">${emoji}</text>
<text x="240" y="420" font-size="30" font-family="sans-serif" font-weight="700" text-anchor="middle" fill="${c0}">${title} (원본 · 더미)</text>
</svg>`;
}

export function pixelSvg(seed: string, category: Category): string {
  const colors = palette(seed, category);
  const h = hash(seed + "px");
  const size = 12;
  const cell = 40;
  let rects = "";
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size / 2; x++) {
      const v = (h >> ((x * 7 + y * 3) % 28)) & 7;
      if (v < 5) {
        const fill = colors[v];
        rects += `<rect x="${x * cell}" y="${y * cell}" width="${cell}" height="${cell}" fill="${fill}"/>`;
        rects += `<rect x="${(size - 1 - x) * cell}" y="${y * cell}" width="${cell}" height="${cell}" fill="${fill}"/>`;
      }
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="480" viewBox="0 0 480 480" shape-rendering="crispEdges">
<rect width="480" height="480" fill="#101014"/>${rects}
</svg>`;
}

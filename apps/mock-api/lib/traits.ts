export type Category = "DOG" | "CAT";

export type TraitCode =
  | "ENERGIZER"
  | "MY_WAY"
  | "CAPITALIST_SMILE"
  | "GRUMPY_BEAST"
  | "UDADA"
  | "PRICKLY"
  | "CHURU_HUNTER"
  | "PUNY_HUMAN";

export interface Score {
  code: TraitCode;
  label: string;
  percent: number;
}

export const TRAITS: Record<Category, { code: TraitCode; label: string }[]> = {
  DOG: [
    { code: "ENERGIZER", label: "에너자이저" },
    { code: "MY_WAY", label: "마이웨이" },
    { code: "CAPITALIST_SMILE", label: "자본주의 미소" },
    { code: "GRUMPY_BEAST", label: "심기불편 맹수" },
  ],
  CAT: [
    { code: "UDADA", label: "우다다" },
    { code: "PRICKLY", label: "까칠도도" },
    { code: "CHURU_HUNTER", label: "츄르헌터" },
    { code: "PUNY_HUMAN", label: "하찮은 닝겐" },
  ],
};

export function analyzeDummy(category: Category): Score[] {
  const weights = TRAITS[category].map(() => Math.random() + 0.05);
  const total = weights.reduce((a, b) => a + b, 0);
  const raw = weights.map((w) => (w / total) * 100);
  const rounded = raw.map((v) => Math.round(v * 10) / 10);
  const diff = Math.round((100 - rounded.reduce((a, b) => a + b, 0)) * 10) / 10;
  rounded[0] = Math.round((rounded[0] + diff) * 10) / 10;
  return TRAITS[category]
    .map((t, i) => ({ code: t.code, label: t.label, percent: rounded[i] }))
    .sort((a, b) => b.percent - a.percent);
}

export function tagOf(scores: Score[]): string {
  return scores
    .slice(0, 2)
    .map((s) => s.label)
    .join(" ");
}

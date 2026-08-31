import { getDb, handle, json, err, requireAuth } from "@/lib/api";
import { kstDayKey, nextKstMidnight, now } from "@/lib/store";

const TABLE: { amount: number; weight: number }[] = [
  { amount: 10, weight: 50 },
  { amount: 20, weight: 30 },
  { amount: 50, weight: 15 },
  { amount: 100, weight: 5 },
];

export const POST = handle(async (req) => {
  const db = getDb();
  const user = requireAuth(db, req);
  const t = now();
  if (user.lastDrawAt && kstDayKey(user.lastDrawAt) === kstDayKey(t))
    err(429, "DRAW_COOLDOWN", "오늘 뽑기를 이미 사용했습니다.", { nextDrawAt: nextKstMidnight() });
  let roll = Math.random() * 100;
  let earned = TABLE[TABLE.length - 1].amount;
  for (const { amount, weight } of TABLE) {
    if (roll < weight) {
      earned = amount;
      break;
    }
    roll -= weight;
  }
  user.point += earned;
  user.lastDrawAt = t;
  return json({ earned, point: user.point, nextDrawAt: nextKstMidnight() });
});

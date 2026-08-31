import { analyzeDummy, tagOf, type Category, type Score, type TraitCode } from "./traits";
import { originalSvg, pixelSvg } from "./images";

export type Provider = "GOOGLE" | "KAKAO" | "NAVER";
export type SaleType = "SALE" | "EXCHANGE";
export type SaleStatus = "ON_SALE" | "SOLD" | "EXCHANGED" | "CANCELED";
export type ExchangeStatus = "PENDING" | "ACCEPTED" | "REJECTED" | "CANCELED";
export type NotificationType =
  | "SALE_SOLD"
  | "EXCHANGE_OFFERED"
  | "EXCHANGE_ACCEPTED"
  | "EXCHANGE_REJECTED"
  | "SALE_CANCELED";

export interface User {
  id: string;
  name: string;
  nickname: string;
  email: string | null;
  password: string | null;
  providers: { provider: Provider; providerId: string }[];
  point: number;
  dailyFreeLimit: number;
  dailyCreatedCount: number;
  dailyCountDate: string;
  unreadCount: number;
  lastDrawAt: string | null;
  createdAt: string;
  deletedAt: string | null;
}

export interface StoredImage {
  data: Buffer;
  mime: string;
}

export interface Card {
  id: string;
  owner: string;
  createdBy: string;
  createdOwnerNickname: string;
  title: string;
  category: Category;
  tag: string;
  scores: Score[];
  description: string | null;
  original: StoredImage;
  pixel: StoredImage;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface Sale {
  id: string;
  cardId: string;
  seller: string;
  type: SaleType;
  status: SaleStatus;
  title: string;
  description: string | null;
  price: number | null;
  wishCategory: Category | null;
  wishDescription: string | null;
  createdAt: string;
  updatedAt: string;
  closedAt: string | null;
}

export interface Exchange {
  id: string;
  saleId: string;
  offerer: string;
  offerCardId: string;
  message: string | null;
  status: ExchangeStatus;
  createdAt: string;
  respondedAt: string | null;
}

export interface Noti {
  id: number;
  userId: string;
  type: NotificationType;
  content: string;
  targetId: string | null;
  isRead: boolean;
  createdAt: string;
  deletedAt: string | null;
}

export interface DB {
  users: Map<string, User>;
  cards: Map<string, Card>;
  sales: Map<string, Sale>;
  exchanges: Map<string, Exchange>;
  notifications: Noti[];
  notiSeq: number;
  accessTokens: Map<string, { userId: string; exp: number }>;
  refreshTokens: Map<string, string>;
}

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";

export function genId(db: DB): string {
  for (;;) {
    let id = "";
    for (let i = 0; i < 6; i++) id += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
    if (!db.users.has(id) && !db.cards.has(id) && !db.sales.has(id) && !db.exchanges.has(id)) return id;
  }
}

export function now(): string {
  return new Date().toISOString();
}

export function kstDayKey(iso: string): string {
  return new Date(new Date(iso).getTime() + 9 * 3600_000).toISOString().slice(0, 10);
}

export function nextKstMidnight(): string {
  const kst = new Date(Date.now() + 9 * 3600_000);
  kst.setUTCHours(24, 0, 0, 0);
  return new Date(kst.getTime() - 9 * 3600_000).toISOString();
}

export function rollDailyCount(user: User): void {
  const today = kstDayKey(now());
  if (user.dailyCountDate !== today) {
    user.dailyCountDate = today;
    user.dailyCreatedCount = 0;
  }
}

function svgImage(svg: string): StoredImage {
  return { data: Buffer.from(svg, "utf8"), mime: "image/svg+xml" };
}

export function buildCardImages(id: string, category: Category, title: string): { original: StoredImage; pixel: StoredImage } {
  return { original: svgImage(originalSvg(id, category, title)), pixel: svgImage(pixelSvg(id, category)) };
}

export function notify(db: DB, userId: string, type: NotificationType, content: string, targetId: string | null): void {
  const user = db.users.get(userId);
  if (!user || user.deletedAt) return;
  db.notifications.push({ id: ++db.notiSeq, userId, type, content, targetId, isRead: false, createdAt: now(), deletedAt: null });
  user.unreadCount += 1;
}

export function activeSaleOf(db: DB, cardId: string): Sale | undefined {
  return [...db.sales.values()].find((s) => s.cardId === cardId && s.status === "ON_SALE");
}

export function cancelPendingOffersWithCard(db: DB, cardId: string): void {
  for (const ex of db.exchanges.values()) {
    if (ex.offerCardId === cardId && ex.status === "PENDING") {
      ex.status = "CANCELED";
      ex.respondedAt = now();
    }
  }
}

export function userMeJson(db: DB, user: User) {
  rollDailyCount(user);
  return {
    id: user.id,
    name: user.name,
    nickname: user.nickname,
    email: user.email,
    point: user.point,
    providers: user.providers.map((p) => p.provider),
    unreadCount: user.unreadCount,
    todayCreatedCount: user.dailyCreatedCount,
    dailyFreeLimit: user.dailyFreeLimit,
    lastDrawAt: user.lastDrawAt,
    createdAt: user.createdAt,
  };
}

export function cardJson(db: DB, card: Card) {
  const owner = db.users.get(card.owner);
  return {
    id: card.id,
    owner: card.owner,
    ownerNickname: owner?.nickname ?? "탈퇴한 사용자",
    createdOwnerNickname: card.createdOwnerNickname,
    title: card.title,
    category: card.category,
    tag: card.tag,
    scores: card.scores,
    description: card.description,
    imageUrl: `/api/v1/cards/${card.id}/image`,
    createdAt: card.createdAt,
    updatedAt: card.updatedAt,
  };
}

export function cardOwnedJson(db: DB, card: Card) {
  const sale = activeSaleOf(db, card.id);
  return {
    ...cardJson(db, card),
    originalImageUrl: `/api/v1/cards/${card.id}/image?type=original`,
    sale: sale ? { id: sale.id, type: sale.type, status: sale.status } : null,
  };
}

export function saleJson(db: DB, sale: Sale) {
  const seller = db.users.get(sale.seller);
  const card = db.cards.get(sale.cardId)!;
  return {
    id: sale.id,
    type: sale.type,
    status: sale.status,
    title: sale.title,
    description: sale.description,
    seller: sale.seller,
    sellerNickname: seller?.nickname ?? "탈퇴한 사용자",
    card: cardJson(db, card),
    price: sale.price,
    wishCategory: sale.wishCategory,
    wishDescription: sale.wishDescription,
    exchangeCount: [...db.exchanges.values()].filter((e) => e.saleId === sale.id && e.status === "PENDING").length,
    createdAt: sale.createdAt,
    updatedAt: sale.updatedAt,
    closedAt: sale.closedAt,
  };
}

export function saleSummaryJson(sale: Sale) {
  return { id: sale.id, type: sale.type, status: sale.status, title: sale.title };
}

export function exchangeJson(db: DB, ex: Exchange) {
  const offerer = db.users.get(ex.offerer);
  const sale = db.sales.get(ex.saleId)!;
  return {
    id: ex.id,
    saleId: ex.saleId,
    sale: saleSummaryJson(sale),
    offerer: ex.offerer,
    offererNickname: offerer?.nickname ?? "탈퇴한 사용자",
    offerCard: cardJson(db, db.cards.get(ex.offerCardId)!),
    message: ex.message,
    status: ex.status,
    createdAt: ex.createdAt,
    respondedAt: ex.respondedAt,
  };
}

export function notiJson(n: Noti) {
  return { id: n.id, type: n.type, content: n.content, targetId: n.targetId, isRead: n.isRead, createdAt: n.createdAt };
}

export function paginate<T>(items: T[], page: number, limit: number) {
  return { items: items.slice((page - 1) * limit, page * limit), page, limit, total: items.length };
}

function seed(): DB {
  const db: DB = {
    users: new Map(),
    cards: new Map(),
    sales: new Map(),
    exchanges: new Map(),
    notifications: [],
    notiSeq: 0,
    accessTokens: new Map(),
    refreshTokens: new Map(),
  };
  const t = now();
  const today = kstDayKey(t);

  const mkUser = (u: Partial<User> & Pick<User, "id" | "name" | "nickname">): User => {
    const user: User = {
      email: null,
      password: null,
      providers: [],
      point: 0,
      dailyFreeLimit: 5,
      dailyCreatedCount: 0,
      dailyCountDate: today,
      unreadCount: 0,
      lastDrawAt: null,
      createdAt: t,
      deletedAt: null,
      ...u,
    };
    db.users.set(user.id, user);
    return user;
  };

  mkUser({
    id: "usr001",
    name: "김건우",
    nickname: "멍집사",
    email: process.env.DEMO_USER1_EMAIL ?? null,
    password: process.env.DEMO_USER1_PASSWORD ?? null,
    point: 1000,
  });
  mkUser({
    id: "usr002",
    name: "이수민",
    nickname: "냥덕후",
    email: process.env.DEMO_USER2_EMAIL ?? null,
    password: process.env.DEMO_USER2_PASSWORD ?? null,
    point: 500,
  });
  mkUser({
    id: "usr003",
    name: "박소셜",
    nickname: "구글러버",
    providers: [{ provider: "GOOGLE", providerId: `google-seed-${crypto.randomUUID()}` }],
    point: 300,
  });

  const mkCard = (id: string, owner: string, createdBy: string, title: string, category: Category, description: string | null): Card => {
    const scores = analyzeDummy(category);
    const creator = db.users.get(createdBy)!;
    const card: Card = {
      id,
      owner,
      createdBy,
      createdOwnerNickname: creator.nickname,
      title,
      category,
      tag: tagOf(scores),
      scores,
      description,
      ...buildCardImages(id, category, title),
      createdAt: t,
      updatedAt: t,
      deletedAt: null,
    };
    db.cards.set(card.id, card);
    return card;
  };

  mkCard("crd001", "usr001", "usr001", "산책왕 초코", "DOG", "공원을 지배하는 갈색 푸들");
  mkCard("crd002", "usr001", "usr001", "간식 앞 천사 보리", "DOG", null);
  mkCard("crd003", "usr002", "usr002", "새벽의 질주자 나비", "CAT", "새벽 4시 우다다 전문");
  mkCard("crd004", "usr002", "usr002", "츄르 감별사 치즈", "CAT", null);
  mkCard("crd005", "usr001", "usr003", "무심한 눈빛 콩이", "DOG", "구글러버가 만들고 멍집사가 구매한 카드");

  const mkSale = (s: Sale): Sale => {
    db.sales.set(s.id, s);
    return s;
  };

  mkSale({
    id: "sal001", cardId: "crd004", seller: "usr002", type: "SALE", status: "ON_SALE",
    title: "치즈 카드 판매", description: "츄르헌터 지수 높음", price: 300,
    wishCategory: null, wishDescription: null, createdAt: t, updatedAt: t, closedAt: null,
  });
  mkSale({
    id: "sal002", cardId: "crd002", seller: "usr001", type: "EXCHANGE", status: "ON_SALE",
    title: "보리 카드 교환 구함", description: null, price: null,
    wishCategory: "CAT", wishDescription: "우다다 지수 높은 고양이 카드 희망", createdAt: t, updatedAt: t, closedAt: null,
  });
  mkSale({
    id: "sal003", cardId: "crd005", seller: "usr003", type: "SALE", status: "SOLD",
    title: "콩이 카드 (판매 완료)", description: null, price: 200,
    wishCategory: null, wishDescription: null, createdAt: t, updatedAt: t, closedAt: t,
  });

  db.exchanges.set("exc001", {
    id: "exc001", saleId: "sal002", offerer: "usr002", offerCardId: "crd003",
    message: "나비 카드와 바꿔요! 우다다 1등입니다.", status: "PENDING", createdAt: t, respondedAt: null,
  });
  notify(db, "usr001", "EXCHANGE_OFFERED", "'보리 카드 교환 구함' 판매글에 교환 오퍼가 도착했습니다.", "sal002");
  notify(db, "usr003", "SALE_SOLD", "'콩이 카드 (판매 완료)' 판매글이 판매되었습니다.", "sal003");
  db.notifications[1].isRead = true;
  db.users.get("usr003")!.unreadCount = 0;

  return db;
}

const g = globalThis as typeof globalThis & { __petcardDb?: DB };

export function getDb(): DB {
  g.__petcardDb ??= seed();
  return g.__petcardDb;
}

export { analyzeDummy, tagOf };
export type { Category, Score, TraitCode };

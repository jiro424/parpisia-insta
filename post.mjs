// Parpisia 自動投稿スクリプト（Instagram コンテンツ公開API / Instagramログイン）
//
// 仕組み：
//   posts.json の products[] から「今日の1件」を日付ローテで選び、
//   1枚なら通常投稿、2枚以上ならカルーセル投稿として @parpisia に公開する。
//
// 必要な環境変数（GitHub Secrets で設定）：
//   IG_ACCESS_TOKEN … Instagram のアクセストークン（必須）
//   IG_USER_ID      … 任意。未設定なら /me から自動取得する
//   DRY_RUN         … "1" のとき、実際には投稿せず内容だけ表示（テスト用）

import { readFile } from "node:fs/promises";

const API = "https://graph.instagram.com";
const VERSION = "v21.0";
const TOKEN = process.env.IG_ACCESS_TOKEN;
const DRY_RUN = process.env.DRY_RUN === "1";

if (!TOKEN) {
  console.error("✖ IG_ACCESS_TOKEN が設定されていません。");
  process.exit(1);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Graph API 呼び出しの共通ヘルパー（POST）
async function post(path, params) {
  const body = new URLSearchParams({ ...params, access_token: TOKEN });
  const res = await fetch(`${API}/${VERSION}/${path}`, { method: "POST", body });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(`POST ${path} 失敗: ${JSON.stringify(json)}`);
  }
  return json;
}

async function get(path, params = {}) {
  const qs = new URLSearchParams({ ...params, access_token: TOKEN });
  const res = await fetch(`${API}/${VERSION}/${path}?${qs}`);
  const json = await res.json();
  if (!res.ok) {
    throw new Error(`GET ${path} 失敗: ${JSON.stringify(json)}`);
  }
  return json;
}

// Instagram ユーザーIDを取得（env になければ /me から）
async function resolveUserId() {
  if (process.env.IG_USER_ID) return process.env.IG_USER_ID;
  const me = await get("me", { fields: "user_id,username" });
  const id = me.user_id || me.id;
  console.log(`ℹ IG_USER_ID 未設定 → /me から取得: ${id} (@${me.username})`);
  return id;
}

// メディアコンテナが公開可能になるまで待つ（特にカルーセルで重要）
async function waitReady(containerId) {
  for (let i = 0; i < 10; i++) {
    const { status_code } = await get(containerId, { fields: "status_code" });
    if (status_code === "FINISHED") return;
    if (status_code === "ERROR") throw new Error(`コンテナ ${containerId} の処理に失敗`);
    await sleep(3000);
  }
  // タイムアウトしても publish を試みる（多くの画像は即時 FINISHED）
}

// キャプションを組み立てる
function buildCaption(cfg, product) {
  const tags = [cfg.defaultHashtags, product.hashtags].filter(Boolean).join(" ");
  return (cfg.captionTemplate || "{title}\n\n{description}\n\n{hashtags}")
    .replaceAll("{title}", product.title || "")
    .replaceAll("{description}", product.description || "")
    .replaceAll("{hashtags}", tags)
    .trim();
}

// 画像ファイル名 → 公開URL
function imageUrls(cfg, product) {
  const base = (cfg.imageBaseUrl || "").replace(/\/?$/, "/");
  return (product.images || []).map((img) =>
    /^https?:\/\//.test(img) ? img : base + img
  );
}

async function main() {
  const cfg = JSON.parse(await readFile(new URL("./posts.json", import.meta.url)));

  // 画像が1枚以上ある商品だけを対象にする
  const products = (cfg.products || []).filter((p) => (p.images || []).length > 0);
  if (products.length === 0) {
    console.error("✖ 投稿できる商品（画像つき）が posts.json にありません。");
    process.exit(1);
  }

  // 日付ローテで「今日の1件」を選ぶ（状態ファイル不要）
  const dayIndex = Math.floor(Date.now() / 86_400_000);
  const product = products[dayIndex % products.length];
  const urls = imageUrls(cfg, product);
  const caption = buildCaption(cfg, product);

  console.log(`▶ 今日の投稿: 「${product.title}」 画像${urls.length}枚`);
  urls.forEach((u) => console.log(`   - ${u}`));
  console.log("--- caption ---\n" + caption + "\n---------------");

  if (DRY_RUN) {
    console.log("🟡 DRY_RUN のため、実際の投稿はしません。");
    return;
  }

  const userId = await resolveUserId();
  let creationId;

  if (urls.length === 1) {
    // 通常（単一画像）投稿
    const c = await post(`${userId}/media`, { image_url: urls[0], caption });
    await waitReady(c.id);
    creationId = c.id;
  } else {
    // カルーセル投稿（最大10枚）
    const children = [];
    for (const url of urls.slice(0, 10)) {
      const child = await post(`${userId}/media`, {
        image_url: url,
        is_carousel_item: "true",
      });
      await waitReady(child.id);
      children.push(child.id);
    }
    const carousel = await post(`${userId}/media`, {
      media_type: "CAROUSEL",
      caption,
      children: children.join(","),
    });
    await waitReady(carousel.id);
    creationId = carousel.id;
  }

  const published = await post(`${userId}/media_publish`, { creation_id: creationId });
  console.log(`✅ 投稿完了！ media id: ${published.id}`);
}

main().catch((err) => {
  console.error("✖ エラー:", err.message);
  process.exit(1);
});

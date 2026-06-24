# Parpisia 自動投稿（Instagram）

@parpisia に、商品画像を**毎日20時（JST）に自動投稿**する仕組みです。
1商品＝1投稿。画像を複数入れると**カルーセル（複数画像）投稿**になります。

費用は **無料**（GitHub の Actions と Pages を使用）。

---

## 構成

```
parpisia-insta/
├── images/        … 商品画像（.jpg）を入れる場所
├── posts.json     … 商品の情報・投稿文・ローテ順（ここを編集して運用）
├── post.mjs       … 投稿スクリプト（基本さわらない）
└── .github/workflows/daily-post.yml … 毎日20時に自動実行（基本さわらない）
```

---

## 初回セットアップ（順番にやればOK）

### 1. GitHub リポジトリを作る
- GitHub（uipiki）で **新規リポジトリ**を作成
- 名前は **`parpisia-insta`**、**Public（公開）** にする
  - ※ Pages で画像を配信するため公開が必要。商品画像が見えるだけなので問題ありません
- このフォルダの中身を全部アップロード（ドラッグ＆ドロップ or git push）

> リポジトリ名を変える場合は、`posts.json` の `imageBaseUrl` の
> `…/parpisia-insta/…` の部分も合わせて直してください。

### 2. GitHub Pages を有効化（画像の公開URL用）
- リポジトリの **Settings → Pages**
- **Source: Deploy from a branch** → **Branch: `main` / `/ (root)`** を選んで Save
- 数分後、`https://uipiki.github.io/parpisia-insta/images/ファイル名.jpg` で画像が見られるようになります
  - 1枚アップして、ブラウザでこのURLを開いて**画像が表示されるか**確認しておくと安心

### 3. アクセストークンを Secret に登録（安全な保管）
- リポジトリの **Settings → Secrets and variables → Actions → New repository secret**
- **Name:** `IG_ACCESS_TOKEN`
- **Secret:** Instagram のアクセストークン（**新しく生成したもの**を貼る）
- 保存
- （任意）`IG_USER_ID` も同様に登録できますが、未設定でも自動取得します

### 4. 商品を登録（posts.json を編集）
- `images/` に商品画像を入れる（例：`barrette-1.jpg`, `barrette-2.jpg`）
- `posts.json` の `products` を編集：
  - `title` … 商品名
  - `description` … ひとこと
  - `images` … 画像の**ファイル名**を並べる（同じ商品の別アングル・色違いを並べるとカルーセルに）
  - `hashtags` … その商品用のタグ（任意）
- `images` が空の商品は**自動でスキップ**されます

### 5. テスト投稿
- リポジトリの **Actions → 「Daily Instagram Post」→ Run workflow**
- まず `dry_run` を **`1`** にして実行 → 投稿内容がログに出るだけ（実際には投稿しない）
- 問題なければ、`dry_run` を **`0`** にして実行 → **実際に投稿される**
- @parpisia に投稿が出れば成功 🎉

これ以降は、**毎日20時に自動**で1件ずつ投稿されます（商品を一巡したら最初に戻ってループ）。

---

## 運用メモ

- **商品を追加したいとき**：`images/` に画像を足して、`posts.json` の `products` に追記するだけ
- **投稿時間を変えたいとき**：`.github/workflows/daily-post.yml` の `cron: "0 11 * * *"` を変更
  （UTC表記。JST20時=UTC11時。例：JST12時にしたいなら `0 3 * * *`）

## ⚠️ トークンの有効期限について（重要）

Instagram のアクセストークンは **約60日で期限切れ**になります。
切れると投稿が止まるので、**2か月に1回くらい**トークンを取り直して、
手順3の `IG_ACCESS_TOKEN`（Secret）を新しい値に**更新**してください。

> 自動更新（毎月トークンをリフレッシュして自動で入れ替える）も後から追加できます。
> 必要になったら相談してください。

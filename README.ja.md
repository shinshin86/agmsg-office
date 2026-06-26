# agmsg Office

[English](README.md) | 日本語

![agmsg Office デモ](docs/agmsg-office-demo.gif)

**agmsg Office** は、[`agmsg`](https://github.com/fujibee/agmsg) のエージェント間
メッセージログを、小さなアニメーションのオフィスとして再生するアプリです。各エージェントが
ステージ上のキャラクターになり、会話が 1 メッセージずつ吹き出しで再生されます。平坦な
ログを読む代わりに、エージェント同士が「会話している」様子を眺められます。

完全にブラウザだけで動きます — バックエンド不要、API キー不要。実体は静的な
Vite + React アプリで、サーバ側のコードは「ローカルの `agmsg` 履歴を読む dev 専用ヘルパー」
だけです（任意・開発時のみ）。

([`agmsg`](https://github.com/fujibee/agmsg) は CLI AI エージェント向けの相互メッセージング。
共有のローカル SQLite を「受信箱」として使い、デーモンもネットワークも不要です。)

> なぜ？ マルチエージェントの実行は、長くて読みづらいメッセージログを生みます。agmsg
> Office は、誰が誰に何を言ったかを順番に「見る」ための、軽量で楽しいビューアです。

---

## 機能

- ログを 1 メッセージずつ**再生**（Start / Stop / Pause、速度調整あり）。
- **キャラクターステージ** — エージェントをチビキャラに割り当て、発言中のエージェントが
  吹き出しを出し、対応するログ行がハイライト＆自動スクロールされます。
- **ホストのナレーション** — ホストキャラ（"Boss"）が再生の開始/終了をアナウンスし、
  `ctrl:` のシステムイベントを読み上げます。
- **3 つのログ源** — 同梱サンプル、ローカルの `agmsg` データ（開発時）、または手動で
  読み込む JSON ファイル。
- **英語 / 日本語**の UI 切替（ブラウザ言語から自動判定し、次回以降も記憶）。同梱デモログも
  両言語で用意。
- **シアターモード** — サイドパネルを隠してステージを横いっぱいに広げ、キャラに集中。
- **ブラウザ完結** — 立てるサーバなし、API キーなし、テレメトリなし。

## 技術スタック

- [Vite](https://vitejs.dev/) + [React 19](https://react.dev/) + TypeScript
- lint / format は [Biome](https://biomejs.dev/)
- 実行時の依存は `react` と `react-dom` のみ。（`npm run dev` 時にローカルの `agmsg`
  データを読む小さな Vite ミドルウェアがありますが、本番ビルドには含まれません。）

## クイックスタート

```bash
npm install
npm run dev      # 開発サーバを起動
```

表示されたローカル URL を開きます。同梱サンプルが自動で読み込まれるので、**Start** を
押すと再生されます。

```bash
npm run build    # 型チェック + 本番ビルド（dist/ に静的ファイル）
npm run preview  # 本番ビルドのプレビュー
npm run lint     # Biome の lint / format チェック
```

---

## 仕組み

生のログレコードからアニメーションのステージまで、小さなパイプラインで動いています。

1. **読み込み（Load）** — ログ源が `agmsg` のメッセージテーブル形式の生レコードを渡します
   （[ログ形式](#ログ形式)参照）。ログ源は、同梱サンプル / ローカル `agmsg` の dev API /
   手動インポートした JSON。
2. **正規化（Normalize）** — `src/lib/agmsg.ts` が生レコードを内部エントリに変換し
   （`from_agent` → `fromAgent` など）、agmsg の正となる順序である数値 `id` で並べ替えます。
   ログ形式を扱う処理はここ 1 か所に集約しています。
3. **キャラ割り当て（Assign）** — 出現したエージェント名を、先着順でアクターキャラに
   割り当てます。アクター枠より多いエージェントがいる場合は、名前の安定ハッシュで
   スプライトを共有するので、同じエージェントは常に同じキャラになります。名札と吹き出しには
   常に実エージェント名が出るため、スプライトを共有しても誰の発言か分かります。ホスト
   （"Boss"）は専用枠で、エージェントには割り当てられません。
4. **再生（Replay）** — タイマーでエントリを 1 件ずつ進めます（Speed で間隔を変更）。
   各エントリで、送信側エージェントのキャラが「発言中」になり吹き出しを出し、受信側は
   「待機中」になり、対応するログ行がハイライト＆スクロールされます。
5. **ホストのナレーション** — 最初のエントリの前にイントロ（`<team> へようこそ。<n> 件の
   メッセージを再生します。`）、最後のエントリの後にアウトロをホストがアナウンスします。
   本文が `ctrl:` で始まる行（`ctrl:despawn` などの agmsg 制御メッセージ）は発言として
   扱わず、**システムメモ**として控えめに表示し、ホストが読み上げます（`ctrl:despawn` では
   退出したエージェント＝受信側 `to_agent` の名前を出します）。
6. **描画（Render）** — `src/components/CharacterActor.tsx` が各キャラをスプライトシートから
   描画し、待機 / 歩行 / ジェスチャのモーションを付けます。現在のログで使われるキャラ
   （＋ホスト）だけが登場し、ログ読み込み時にフェードインで現れます。

以上はすべてクライアント側の React 状態です。任意の dev API（`vite.config.ts`）だけが
サーバ側コードで、`npm run dev` の時のみ動きます。

## 使い方

サイドパネルに操作系があります。

- **Source** — 再生するログを選ぶドロップダウン：**Sample** か、ローカルの `agmsg` チーム
  （開発時）。選ぶと読み込みます（自動再生はしません）。
- **Playback** — **Start** / **Stop**（トグル）、**Pause**、**Speed** スライダー。
- **Advanced**（既定で折りたたみ）— **Import JSON**、**Reload current team**、ログ時刻の
  **日付を表示**トグル。
- **言語** — ヘッダーの `EN` / `日本語` トグル。
- **シアター** — キャプションバー（ステージ下部）のトグル。サイドパネルを隠してステージを
  全幅に広げます。もう一度押すと解除。
- **現在の行** — キャプションバーに現在のメッセージを表示。折りたたみ可能・固定高さなので、
  再生中にステージがガタつきません。

---

## ログの与え方

agmsg Office は `agmsg` のメッセージテーブル形式の JSON を受け取ります。与え方は 3 通り。

### 1. 同梱サンプル

公開デモログが同梱され、起動時に読み込まれます。英語版・日本語版は以下にあります。

```text
public/sample/agmsg-sample.json
public/sample/agmsg-sample.ja.json
```

Source ドロップダウンで **Sample** を選べばいつでも戻れます。言語トグルで表示する版が
切り替わります。

### 2. ローカル agmsg（開発時）

`npm run dev` の間、Vite 開発サーバが読み取り専用のヘルパー API を公開します。

```text
GET /api/agmsg/teams
GET /api/agmsg/history?team=<team>&limit=80
```

`~/.agents/skills/agmsg/teams` 配下の全チームを列挙し、インストール済みの `agmsg`
スクリプト経由でメッセージ履歴を読み取ります。Source ドロップダウンでチームを選ぶと、
実際の会話を再生できます。スクリプトやデータが無ければ同梱サンプルにフォールバックします。
このミドルウェアは開発時専用で、本番ビルドには入りません。

### 3. 手動 JSON インポート

**Advanced** 内の **Import JSON** からローカルの `.json` ファイル（下記形式のレコード配列）を
読み込みます。

`agmsg` はメッセージを SQLite に保存し、JSON エクスポート機能は内蔵していませんが、テーブルが
この形式にそのまま対応するため、`sqlite3` で互換 JSON をダンプできます。

```bash
sqlite3 ~/.agents/skills/agmsg/db/messages.db \
  "SELECT json_group_array(json_object(
     'id',id,'team',team,'from_agent',from_agent,'to_agent',to_agent,
     'body',body,'created_at',created_at,'read_at',read_at))
   FROM messages WHERE team='YOUR_TEAM' ORDER BY id;"
```

出力を `.json` として保存し、ブラウザでインポートしてください。

## ログ形式

各レコードは `agmsg` の `messages` テーブルに対応します。

```jsonc
{
  "id": 1,                                // 整数。正となる並び順
  "team": "product-studio",
  "from_agent": "lead",                   // 送信元
  "to_agent": "dev",                      // 宛先（常に存在）
  "body": "Please check the latest build.",
  "created_at": "2026-06-24T00:00:00Z",   // ISO 8601 UTC
  "read_at": null                         // ISO 8601 UTC、未読なら null
}
```

本文が `ctrl:`（例：`ctrl:despawn`）で始まる行は agmsg の制御メッセージで、キャラの発言では
なくシステムメモとして表示されます。

## キャラクター

ホストは **Boss**（Miko キャラ）。常にステージにいて再生の進行役を務め、エージェントには
なりません。アクターのスプライトは **Mai, Haya, Suzu, Kii, Rin, Nao, Mio, Sora** の 8 体で、
1 エージェントにつき 1 キャラです。

エージェントは先着順でアクター枠に入ります。9 体以上の場合は、余りが名前の安定ハッシュで
アクタースプライトを共有します。名札と吹き出しには常に実エージェント名が出るので、誰の
発言か明確です。`agmsg` のチームに人数上限は無いため、これでどんな規模のチームでも閲覧
できます。

## プロジェクト構成

```text
src/
  App.tsx                     # アプリ本体：ステージ・操作系・ログパネル・再生エンジン
  components/CharacterActor.tsx  # キャラのスプライト、モーション、吹き出し
  lib/agmsg.ts                # ログ正規化 + エージェント→キャラ割当 + 整形
  lib/i18n.ts                 # UI 文言（en/ja）と言語・日付ヘルパー
  types.ts                    # 共有の型
  styles/app.css              # スタイル（明るくシンプルなテーマ）
public/
  assets/                     # キャラ・背景・プロップと assets.json マニフェスト
  sample/                     # 同梱デモログ（en + ja）
vite.config.ts                # Vite 設定 + dev 専用のローカル agmsg API
scripts/generate-portrait-spritesheets.py  # 立ち絵からスプライトシートを生成
```

## アセット

キャラのスプライトシートは `public/assets/characters/<id>/spritesheet.webp` にあり、
8×9 のアトラス順に並んでいます。

| 行 | 状態 |
| --- | --- |
| 0 | idle |
| 1 | running-right |
| 2 | running-left |
| 3 | waving |
| 4 | jumping |
| 5 | failed |
| 6 | waiting |
| 7 | running |
| 8 | review |

各スプライトシートは、1 枚の透過全身立ち絵（`portrait.png`）から生成されます。再生成は
以下で行います。

```bash
npm run assets:generate-sprites
```

## クレジット

Miko キャラクター（本アプリではホスト "Boss" として使用）は Miko (AITuberOnAir) の提供です：
https://miko.aituberonair.com/

## ライセンス

[MIT](LICENSE)

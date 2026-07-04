# agmsg Office — 詳細

[← README に戻る](../README.ja.md)

操作方法・データ・キャラクター・内部構成の詳しい説明です。概要とクイックスタートは
[README](../README.ja.md) を参照してください。

## 使い方

操作はサイドパネルにまとまっています。

- **Source** — 再生するログを選びます：**Sample**、またはローカルの `agmsg` チーム
  （開発時）。選ぶと読み込みます（自動再生はしません）。
- **Playback** — **Start** / **Stop**（トグル）、**Pause**、**Speed** スライダー。
- **Advanced**（既定で折りたたみ）— **Import JSON**、**Reload current team**、ログ時刻の
  **日付を表示**トグル。
- **言語** — ヘッダーの `EN` / `日本語` トグル（ブラウザ言語から自動判定し、次回以降も記憶）。
- **シアター** — キャプションバーのトグル。サイドパネルを隠してステージを全幅に広げます。
  もう一度押すと解除します。
- **現在の行** — キャプションバーに現在のメッセージを表示します。折りたたみ可能・固定高さ
  なので、再生中にステージがガタつきません。

## 仕組み

生のログレコードからアニメーションのステージまで、小さなパイプラインで動いています。

1. **読み込み（Load）** — `agmsg` のメッセージテーブル形式の生レコードを、ログのソース
   から読み込みます（[ログ形式](#ログ形式)参照）。ソースは、同梱サンプル / ローカル `agmsg`
   の dev API / 手動でインポートした JSON のいずれかです。
2. **正規化（Normalize）** — `src/lib/agmsg.ts` が生レコードを内部エントリに変換し
   （`from_agent` → `fromAgent` など）、agmsg の正となる順序である数値 `id` で並べ替えます。
   ログ形式を扱う処理はここ 1 か所に集約しています。
3. **キャラ割り当て（Assign）** — 出現したエージェント名を、先着順でアクターキャラに
   割り当てます。アクター枠より多い場合は、名前の安定ハッシュでスプライトを共有するので、
   同じエージェントは常に同じキャラになります。名札と吹き出しには常に実エージェント名が
   出ます。ホスト（"Boss"）は専用枠で、エージェントには割り当てられません。
4. **再生（Replay）** — タイマーでエントリを 1 件ずつ進めます（Speed で間隔を変更）。各
   エントリで、送信側エージェントのキャラが「発言中」になり吹き出しを出し、受信側は「待機中」
   になり、対応するログ行がハイライト＆スクロールされます。
5. **ホストのナレーション** — 最初のエントリの前にイントロ、最後のエントリの後にアウトロを
   ホストがアナウンスします。本文が `ctrl:` で始まる行（`ctrl:despawn` などの agmsg 制御
   メッセージ）は発言として扱わず、システムメモとして控えめに表示し、ホストが読み上げます
   （`ctrl:despawn` では退出したエージェント＝受信側を名前で示します）。
6. **描画（Render）** — `src/components/CharacterActor.tsx` が各キャラをスプライトシートから
   描画し、待機 / 歩行 / ジェスチャのモーションを付けます。現在のログで使われるキャラ
   （＋ホスト）だけが登場し、ログ読み込み時にフェードインで現れます。
   待機中の各キャラは `src/lib/motionPersonality.ts` に定義された自分だけの
   モーション個性（歩く速さ・行動範囲・休憩のリズム・好きなジェスチャ・オフィス横断散歩の
   頻度）に従ってオフィス内を動き回ります。カスタムキャラには id から決定論的に個性が
   導出されるので、アップロードしたキャラも常に同じ動き方をします。

ここまでの処理はすべてブラウザ側（React の状態）で完結します。サーバ側のコードは
`vite.config.ts` のローカル agmsg API だけで、これは `npm run dev` の時のみ動きます。

## ログの与え方

agmsg Office は `agmsg` のメッセージテーブル形式の JSON を受け取ります。与え方は 3 通りです。

### 1. 同梱サンプル

デモログが同梱され、起動時に読み込まれます。英語版・日本語版は以下にあります。

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

`~/.agents/skills/agmsg/teams` 配下のチームを列挙し、インストール済みの `agmsg` スクリプト
経由でメッセージ履歴を読み取ります。Source ドロップダウンでチームを選ぶと、実際の会話を
再生できます。スクリプトやデータが無ければ同梱サンプルにフォールバックします。この
ミドルウェアは開発時専用で、本番ビルドには含まれません。

Windows では、この dev API が `.sh` スクリプトを Bash 経由で実行します。Git for Windows の
既定インストール先は自動検出します。別の場所に Bash がある場合は、開発サーバ起動前に
`AGMSG_BASH` へ `bash.exe` のフルパスを指定してください。

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

ホストは **Boss**（Miko キャラ）。常にステージにいて進行役を務め、エージェントにはなりません。
アクターのスプライトは **Mai, Haya, Suzu, Kii, Rin, Nao, Mio, Sora** の 8 体で、1 エージェント
につき 1 キャラです。

エージェントは先着順でアクター枠に入ります。9 体以上の場合は、余りが名前の安定ハッシュで
アクタースプライトを共有します。名札と吹き出しには常に実エージェント名が出るので、誰の発言か
明確です。`agmsg` のチームに人数上限は無いため、これでどんな規模のチームでも閲覧できます。

各キャラには待機中の**モーション個性**（`src/lib/motionPersonality.ts`）があります。
Boss はオフィス全体を巡回し、Haya はすばしっこく動き回ってジャンプし、Suzu はほとんど
席を離れずじっくりレビューし、Kii はよく同僚に手を振る、といった具合です。カスタムキャラは
id のハッシュから個性が導出されるので、アップロードしたキャラも一貫した独自の動き方をします。

## プロジェクト構成

```text
src/
  main.tsx                    # エントリーポイント
  App.tsx                     # アプリ本体：ステージ・操作系・ログパネル・再生エンジン
  components/CharacterActor.tsx  # キャラのスプライト、モーション、吹き出し
  lib/agmsg.ts                # ログ正規化 + エージェント→キャラ割当 + 整形
  lib/motionPersonality.ts    # キャラごとの待機モーション個性
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

キャラのスプライトシートは `public/assets/characters/<id>/spritesheet.webp` にあり、8×9 の
アトラス順に並んでいます。

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

各アクターのスプライトシートは、1 枚の透過全身立ち絵（`portrait.png`）から生成されます。
8 体のアクターのスプライトシートは以下で再生成できます（ホスト "Boss" のスプライトシートは
別途用意されています）。

```bash
npm run assets:generate-sprites
```

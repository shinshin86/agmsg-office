# agmsg Character Sprites

[English](README.md) | 日本語

このスキルは、agmsg Office 用のキャラクタースプライトシートを生成・検証するためのものです。

## クイックスタート用プロンプト

`portrait.png` は、キャラクターの見た目の基準として使う 1 枚の画像（ポートレート）です。スキルはこれを参照し、見た目を揃えながら各ポーズのアニメーション画像を生成します。

この `portrait.png` を添付（またはパスで指定）してから、次のプロンプトを Codex に貼り付けて生成を開始します。

```text
$agmsg-character-sprites を使って、添付した画像から agmsg Office 用のキャラクタースプライトシートを生成し、QA と検証を通したうえで、アップロード用の最終 spritesheet.webp を教えて。
```

実行は Codex App（または `$imagegen` と `$hatch-pet` スキルが入った Codex 環境）で行ってください。スキルは、ポーズごとの画像生成、それらを 1 枚のスプライトシートにまとめる処理、サイズや形式の検証までを自動で行います。詳しい手順は `SKILL.md` と `references/workflow.md` を参照してください。

## アプリへのアップロードの流れ

1. このスキルでスプライトシートを生成し、QA を行う。
2. 検証済みの最終ファイル `RUN_DIR/final/spritesheet.webp` を使う。
3. agmsg Office を起動する：

```bash
npm run dev
```

4. 「配役」パネルを開く。
5. スロットを選び、**キャラを差し替え** をクリックする。
6. 生成した `spritesheet.webp` をアップロードする。
7. 必要に応じて `portrait.png` もアップロードする。

アプリの開発サーバが `public/assets/characters/custom/` 配下にファイルを保存し、`custom/characters.json` を自動で更新します。JSON マニフェストを手で編集する必要はありません。

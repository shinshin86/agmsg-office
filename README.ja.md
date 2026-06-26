# agmsg Office

[English](README.md) | 日本語

![agmsg Office デモ](docs/agmsg-office-demo.gif)

**agmsg Office** は、[`agmsg`](https://github.com/fujibee/agmsg) のエージェント間
メッセージログを、キャラクターがステージで会話する形で再生するアプリです。平坦なログを
読む代わりに、エージェントが順番に発言する様子を眺められます。完全にブラウザだけで動く
静的な Vite + React アプリで、バックエンドや API キーは不要です。

## クイックスタート

```bash
npm install
npm run dev
```

表示された URL を開くと、同梱サンプルが自動で読み込まれます。**Start** を押すと再生されます。
本番ビルドは `npm run build`、整形チェックは `npm run lint` で行います。

## 仕組み

agmsg Office は、agmsg のログを読み込み、正規化し、各エージェントにキャラクターを割り当て、
メッセージを 1 件ずつ再生します。発言中のエージェントが吹き出しを出し、対応するログ行が
ハイライトされます。ホストキャラが、開始・終了やシステムイベントをナレーションします。

ログの取得元は 3 つあります。**同梱サンプル**（既定）、**ローカルの agmsg 履歴**（開発時）、
または**手動でインポートする JSON ファイル**です。

## もっと詳しく

操作方法・ログ形式・キャラクター一覧・プロジェクト構成・内部の仕組みは
**[docs/details.ja.md](docs/details.ja.md)** を参照してください。

## クレジット

Miko キャラクター（本アプリではホスト "Boss" として使用）は Miko (AITuberOnAir) の提供です：
https://miko.aituberonair.com/

## ライセンス

[MIT](LICENSE)

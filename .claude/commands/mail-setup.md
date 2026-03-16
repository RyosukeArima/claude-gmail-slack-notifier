Gmail → Slack通知の初期セットアップウィザード。対話形式でユーザーを案内する。

## 進め方

ステップごとにユーザーに確認を取りながら進めること。一度に全部説明しない。

## Step 1: 説明

以下を伝える:
```
このプロジェクトは、Gmailの新着メールを1時間に1回チェックして、Slackにサマリーを通知する仕組みです。

必要なもの:
- Slack App（Incoming Webhook用）
- 通知先のSlackチャンネル

所要時間は5分程度です。始めましょう。
```

## Step 2: Slackチャンネル

ユーザーに聞く: 「通知を送りたいSlackチャンネル名を教えてください。既存でも新規でもOKです。」

回答を控えておく（後のステップで使う）。

## Step 3: Slack App作成ガイド

以下を1つずつ案内する（まとめて出さない）:

1. 「まず https://api.slack.com/apps を開いてください。開けたら教えてください。」
2. 「右上の『Create New App』→『From scratch』を選んでください。」
3. 「App名は何でもOKです（例: Gmail Notifier）。ワークスペースを選んで『Create App』を押してください。」
4. 「左メニューの『Incoming Webhooks』をクリックして、右上のトグルを『On』にしてください。」
5. 「ページ下部の『Add New Webhook to Workspace』をクリック → 先ほどのチャンネル（{Step 2の回答}）を選択 →『許可する』を押してください。」
6. 「生成されたWebhook URL（https://hooks.slack.com/services/... の形式）をコピーして、ここに貼り付けてください。」

## Step 4: Webhook URLの設定とテスト

1. ユーザーから受け取ったWebhook URLで接続テストを行う:
   ```bash
   curl -s -X POST -H 'Content-Type: application/json' \
     -d '{"text":"Gmail Notifier 接続テスト完了"}' "受け取ったURL"
   ```
2. 成功したら「Slackにテストメッセージが届いていますか？」と確認する。
3. 成功を確認したら、~/.zshrc に追記する:
   ```bash
   echo 'export SLACK_WEBHOOK_URL="受け取ったURL"' >> ~/.zshrc
   ```

## Step 5: Slack User ID

1. 「次に、あなたのSlack User IDが必要です。Slackで自分のプロフィールを開いて、『...』メニュー →『メンバーIDをコピー』で取得できます。コピーしたらここに貼ってください。」
2. 受け取ったIDを ~/.zshrc に追記する:
   ```bash
   echo 'export SLACK_USER_ID="受け取ったID"' >> ~/.zshrc
   ```

## Step 6: 初回メールチェック

1. 環境変数をexportしてから、CLAUDE.md の「メールキャッチアップ」手順を実行する。
2. Slackに通知が届いたことをユーザーに確認する。
   - 新着0件の場合は「新着メールはありませんでした。」と伝える。

## Step 7: Cronジョブ登録

CLAUDE.md の「Cronジョブ登録」手順に従い、毎時55分のジョブを登録する。

## Step 8: 完了

以下を伝える:
```
セットアップ完了です。

- Slack通知: 毎時55分に自動チェック
- 手動チェック: /mail-check でいつでも実行可能
- 返信の下書き: 通知の番号を使って「3番の返信下書き作って」で作成
- 次回起動時: 自動でキャッチアップ＋Cron再登録されます

※ Cronジョブはこのセッション中のみ有効です（最大3日）。
  セッション切れ後もClaude Code再起動で自動復旧します。
```

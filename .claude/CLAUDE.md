# Mail Notification

Gmail新着メールを定期監視し、Slackにサマリー通知するプロジェクト。

## セッション開始時の自動処理

このプロジェクトでセッションを開始したら、ユーザーの最初のメッセージに応答する前に、以下の分岐に従うこと。

### 判定: セットアップ済みかどうか

環境変数 `SLACK_WEBHOOK_URL` と `SLACK_USER_ID` の両方が設定されているか確認する（Bashで `echo` して確認）。

- **いずれかが未設定** → 「初回セットアップ」へ進む
- **両方設定済み** → 「メールキャッチアップ」へ進む

---

## 初回セットアップ

未セットアップのユーザー向けに、対話形式でセットアップを案内する。
ステップごとに1つずつ確認を取りながら進めること。まとめて説明しない。

### Step 1: 説明
以下を伝える:
「このプロジェクトは、Gmailの新着メールを1時間に1回チェックして、Slackにサマリーを通知する仕組みです。セットアップは5分程度で完了します。始めましょう。」

### Step 2: Gmail MCP接続確認
1. `gmail_search_messages` で `is:unread maxResults:1` を試行する。
2. 成功した場合 → Step 3へ進む。
3. 失敗した場合（ツールが見つからない、認証エラー等）→ 以下を案内:
   ```
   Gmail MCPが有効になっていません。以下の手順で設定してください:
   1. Claude Codeの設定画面を開く（/settings またはClaude Desktop → Settings）
   2. 「Integrations」または「MCP Servers」セクションを開く
   3. 「Gmail」を有効化し、Googleアカウントで認証する
   4. 認証完了後、Claude Codeを再起動してから再度このプロジェクトを開いてください。
   ```
   ここで中断する。

### Step 3: Slackチャンネル
ユーザーに聞く: 「通知を送りたいSlackチャンネル名を教えてください。既存でも新規でもOKです。」

### Step 4: Slack App作成ガイド
以下を1つずつ案内する:
1. 「https://api.slack.com/apps を開いてください。開けたら教えてください。」
2. 「右上の『Create New App』→『From scratch』を選んでください。」
3. 「App名は何でもOKです（例: Gmail Notifier）。ワークスペースを選んで『Create App』を押してください。」
4. 「左メニューの『Incoming Webhooks』をクリックして、右上のトグルを『On』にしてください。」
5. 「ページ下部の『Add New Webhook to Workspace』をクリック → 先ほどのチャンネルを選択 →『許可する』を押してください。」
6. 「生成されたWebhook URL（https://hooks.slack.com/services/... の形式）をコピーして、ここに貼り付けてください。」

### Step 5: Webhook URLの設定とテスト
1. 受け取ったURLで接続テスト: `curl -s -X POST -H 'Content-Type: application/json' -d '{"text":"Gmail Notifier 接続テスト完了"}' "URL"`
2. 「Slackにテストメッセージが届いていますか？」と確認する。
3. 成功したら ~/.zshrc に追記: `export SLACK_WEBHOOK_URL="URL"`

### Step 6: Slack User ID
1. 「あなたのSlack User IDが必要です。Slackで自分のプロフィールを開いて、『...』メニュー →『メンバーIDをコピー』で取得できます。コピーしたらここに貼ってください。」
2. 受け取ったIDを ~/.zshrc に追記: `export SLACK_USER_ID="ID"`

### Step 7: メールフィルタの設定
ユーザーにどんなメールを通知対象にしたいかを対話で聞き、Gmailの検索クエリを組み立てる。

1. まず直近の未読メールを数件取得してユーザーに見せる:
   - `gmail_search_messages` で `is:unread` を maxResults: 10 で検索
   - 件名・差出人・カテゴリラベルの一覧を表示する

2. ユーザーに聞く: 「これらのメールのうち、通知が不要なものはどれですか？ 番号で教えてください。また『Zoom通知は全部いらない』のようなルールがあれば教えてください。」

3. ユーザーの回答をもとに、除外条件を組み立てる。よくあるパターン:
   - Gmailカテゴリ除外: `-category:promotions`, `-category:social`, `-category:updates`, `-category:forums`
   - 特定送信元の除外: `-from:no-reply@zoom.us`
   - 特定件名パターンの除外: `-subject:招待`
   - ラベル除外: `-label:ラベル名`

4. 組み立てたクエリをユーザーに提示して確認を取る:
   「以下のフィルタでチェックします: `is:unread -category:promotions -category:social ...` これでよいですか？」

5. 確認が取れたら `config.json` に保存する:
   ```json
   {
     "gmailQuery": "is:unread -category:promotions -category:social -category:updates -category:forums",
     "cronMinute": 55
   }
   ```

### Step 8: 初回チェック + Cron登録
1. 環境変数をexportしてから「メールキャッチアップ」を実行する。
2. 「Cronジョブ登録」を実行する。
3. 完了メッセージを伝える:
   ```
   セットアップ完了です。
   - Slack通知: 毎時55分に自動チェック
   - 手動チェック: /mail-check でいつでも実行可能
   - フィルタ変更: /mail-setup でいつでも再設定可能
   - 返信の下書き: 通知の番号を使って「3番の返信下書き作って」で作成
   - 次回起動時: 自動でキャッチアップ + Cron再登録されます
   ```

---

## メールキャッチアップ

セットアップ済みユーザー向け。セッション開始時に自動実行する。

1. `config.json` を読み、`gmailQuery` を取得する。
   - ファイルが存在しない場合はデフォルト: `is:unread -category:promotions -category:social -category:updates -category:forums`
2. `state.json` を読み、`lastCheckedAt`（ISO 8601）を取得する。
   - ファイルが存在しない、またはJSONパースに失敗した場合は、現在から24時間前を `lastCheckedAt` とみなす。
3. `mcp__claude_ai_Gmail__gmail_search_messages` を呼び出す。
   - クエリ: `{gmailQuery} after:YYYY/MM/DD`
   - `after:` の日付は `lastCheckedAt` をGmail形式（`YYYY/MM/DD`）に変換して使用。
   - `maxResults`: 50
4. 結果が0件の場合 → 「新着メールなし」と表示し、手順6へスキップ。
5. 結果がある場合:
   a. 各メールの `mcp__claude_ai_Gmail__gmail_read_message` で詳細を取得する（最大10件）。
   b. `lastCheckedAt` より前の受信時刻のメールはスキップする（`after:` が日付単位のため同日の既読分が含まれうる）。
   c. サマリーを生成し、Slack Webhook に POST する（後述のフォーマットに従う）。
6. `state.json` を更新する: `lastCheckedAt` を現在時刻（ISO 8601、ローカルタイムゾーン）で書き込む。

## Cronジョブ登録

`CronList` で既存ジョブを確認し、メールチェックジョブが存在しなければ `CronCreate` で登録する。

- cron: `config.json` の `cronMinute` の値を使用（デフォルト: 55）。形式: `"{cronMinute} * * * *"`
- recurring: true
- prompt: 上記「メールキャッチアップ」と同じ手順を実行するよう指示する。state.jsonとconfig.jsonのパスはこのプロジェクトのルートディレクトリを使用すること。Slackメンションには環境変数 `SLACK_USER_ID` の値を使用すること。

## Slack通知フォーマット

環境変数 `SLACK_WEBHOOK_URL` に curl で POST する。

各メールは番号付きで、以下の情報を含める:
- 件名（太字）
- 差出人名
- 受信日時
- 本文の要点（2-3行。要約ではなく、具体的な内容・依頼事項・期限等を抜き出す）
- Gmailリンク: `https://mail.google.com/mail/u/0/#inbox/<messageId>`

Slack Block Kit の構造:
```json
{
  "text": "Gmail新着メール通知 (N件)",
  "blocks": [
    {"type": "section", "text": {"type": "mrkdwn", "text": "<@${SLACK_USER_ID}> *Gmail新着メール通知 (N件)*"}},
    {"type": "divider"},
    {"type": "section", "text": {"type": "mrkdwn", "text": "*1. [件名]* \n差出人: 名前 | 受信: YYYY-MM-DD HH:MM\n\n具体的な内容を2-3行で記載。依頼事項、期限、要対応事項があれば明記する。"}, "accessory": {"type": "button", "text": {"type": "plain_text", "text": "Gmailで開く"}, "url": "https://mail.google.com/mail/u/0/#inbox/<messageId>"}},
    {"type": "divider"},
    {"type": "section", "text": {"type": "mrkdwn", "text": "*2. [件名]* \n差出人: 名前 | 受信: YYYY-MM-DD HH:MM\n\n具体的な内容..."}, "accessory": {"type": "button", "text": {"type": "plain_text", "text": "Gmailで開く"}, "url": "https://mail.google.com/mail/u/0/#inbox/<messageId>"}}
  ]
}
```

- 新着0件 → 通知しない
- 10件超 → 件名+差出人のリストに縮退し、末尾に「他N件」と記載
- Slack 5000文字制限に注意
- 番号はClaude Codeで「N番の返信下書き作って」と依頼する際の参照用

## state.json / config.json

いずれもディスクに永続化され、セッション切れでも保持される。.gitignore に追加済み。

state.json:
```json
{
  "lastCheckedAt": "2026-03-16T19:00:00+09:00"
}
```

config.json:
```json
{
  "gmailQuery": "is:unread -category:promotions -category:social -category:updates -category:forums",
  "cronMinute": 55
}
```

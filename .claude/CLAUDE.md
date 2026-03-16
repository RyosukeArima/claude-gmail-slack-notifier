# Mail Notification

Gmail新着メールを定期監視し、Slackにサマリー通知するプロジェクト。

## セッション開始時の自動処理

このプロジェクトでセッションを開始したら、ユーザーの最初のメッセージに応答する前に、以下の分岐に従うこと。

### 判定: セットアップ済みかどうか

環境変数 `SLACK_WEBHOOK_URL` と `SLACK_USER_ID` の両方が設定されているか確認する（Bashで `echo` して確認）。

- **いずれかが未設定** → 「初回セットアップ」へ進む
- **両方設定済み** → 「ウェルカムメッセージ」を表示してから「メールキャッチアップ」へ進む

### ウェルカムメッセージ

セットアップ済みユーザーの最初のメッセージに対して、以下を表示する（メールキャッチアップの前に表示）:

```
███╗   ███╗ █████╗ ██╗██╗
████╗ ████║██╔══██╗██║██║
██╔████╔██║███████║██║██║
██║╚██╔╝██║██╔══██║██║██║
██║ ╚═╝ ██║██║  ██║██║███████╗
╚═╝     ╚═╝╚═╝  ╚═╝╚═╝╚══════╝
███╗   ██╗ ██████╗ ████████╗██╗███████╗██╗███████╗██████╗
████╗  ██║██╔═══██╗╚══██╔══╝██║██╔════╝██║██╔════╝██╔══██╗
██╔██╗ ██║██║   ██║   ██║   ██║█████╗  ██║█████╗  ██████╔╝
██║╚██╗██║██║   ██║   ██║   ██║██╔══╝  ██║██╔══╝  ██╔══██╗
██║ ╚████║╚██████╔╝   ██║   ██║██║     ██║███████╗██║  ██║
╚═╝  ╚═══╝ ╚═════╝    ╚═╝   ╚═╝╚═╝     ╚═╝╚══════╝╚═╝  ╚═╝
Gmail → Slack

/mail-check  今すぐ確認
/mail-setup  設定を変更
/help        使い方ガイド
Slackの「下書き作成」ボタンで返信下書き
```

表示後、メールキャッチアップを実行する。

---

## 初回セットアップ

未セットアップのユーザー向け。まず以下を表示する:

```
███╗   ███╗ █████╗ ██╗██╗
████╗ ████║██╔══██╗██║██║
██╔████╔██║███████║██║██║
██║╚██╔╝██║██╔══██║██║██║
██║ ╚═╝ ██║██║  ██║██║███████╗
╚═╝     ╚═╝╚═╝  ╚═╝╚═╝╚══════╝
███╗   ██╗ ██████╗ ████████╗██╗███████╗██╗███████╗██████╗
████╗  ██║██╔═══██╗╚══██╔══╝██║██╔════╝██║██╔════╝██╔══██╗
██╔██╗ ██║██║   ██║   ██║   ██║█████╗  ██║█████╗  ██████╔╝
██║╚██╗██║██║   ██║   ██║   ██║██╔══╝  ██║██╔══╝  ██╔══██╗
██║ ╚████║╚██████╔╝   ██║   ██║██║     ██║███████╗██║  ██║
╚═╝  ╚═══╝ ╚═════╝    ╚═╝   ╚═╝╚═╝     ╚═╝╚══════╝╚═╝  ╚═╝
Gmail → Slack

初回セットアップを開始します。
```

その後、`/mail-setup` コマンドの手順に従って対話形式で案内する。

ただし、`/mail-setup` の前に Gmail MCP の接続確認を行う:
1. `gmail_search_messages` で `is:unread maxResults:1` を試行する。
2. 成功した場合 → `/mail-setup` の手順を開始する。
3. 失敗した場合（ツールが見つからない、認証エラー等）→ 以下を案内:
   ```
   Gmail MCPが有効になっていません。以下の手順で設定してください:
   1. Claude Codeの設定画面を開く（/settings またはClaude Desktop → Settings）
   2. 「Integrations」または「MCP Servers」セクションを開く
   3. 「Gmail」を有効化し、Googleアカウントで認証する
   4. 認証完了後、Claude Codeを再起動してから再度このプロジェクトを開いてください。
   ```
   ここで中断する。

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
   a. 各メールの `mcp__claude_ai_Gmail__gmail_read_message` で詳細を取得する（最大10件）。11件目以降は件名+差出人のみリスト表示し、本文の要約は付けない。
   b. `lastCheckedAt` より前の受信時刻のメールはスキップする（`after:` が日付単位のため同日の既読分が含まれうる）。
   c. 各メールについて返信が必要か判断する。以下は返信不要と判断する:
      - no-reply / noreply 系の送信元
      - カレンダー招待（件名が「招待:」で始まる等）
      - 自動通知・システムメール
   d. 返信が必要なメールには返信案テキストを生成する（日本語、ビジネス敬語、簡潔に）。
   e. `config.json` に `gasWebAppUrl` が設定されている場合、各返信案をGAS Web Appに保存する:
      - Claude Code側でUUIDを生成する（`uuidgen` コマンド等）
      - 返信案データをbase64エンコードしてGETリクエストで送信（`--data-urlencode` で `=` 等をエスケープ）:
      ```
      DATA=$(echo -n '{"messageId":"<id>","subject":"<件名>","replyBody":"<返信案>"}' | base64 | tr -d '\n')
      curl -sL -G "<gasWebAppUrl>" \
        --data-urlencode "action=save" \
        --data-urlencode "token=<gasAuthToken>" \
        --data-urlencode "id=<UUID>" \
        --data-urlencode "data=${DATA}" \
        -o /dev/null
      ```
      - 生成したUUIDを各メールに紐づける。
   f. サマリーを生成し、Slack Webhook に POST する（後述のフォーマットに従う）。
6. `state.json` を更新する: `lastCheckedAt` を現在時刻（ISO 8601、ローカルタイムゾーン）で書き込む。

## Cronジョブ登録

`CronList` で既存ジョブを確認し、メールチェックジョブが存在しなければ `CronCreate` で登録する。
既存ジョブの判定: promptに「メールキャッチアップ」または「gmail_search_messages」を含むジョブがあれば登録済みとみなす。

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
    {"type": "section", "text": {"type": "mrkdwn", "text": "*1. [件名]* \n差出人: 名前 | 受信: YYYY-MM-DD HH:MM\n\n具体的な内容を2-3行で記載。依頼事項、期限、要対応事項があれば明記する。\n\n> *返信案:* 返信案の冒頭1-2行をここに表示..."}},
    {"type": "actions", "elements": [
      {"type": "button", "text": {"type": "plain_text", "text": "Gmailで開く"}, "url": "https://mail.google.com/mail/u/0/#inbox/<messageId>"},
      {"type": "button", "text": {"type": "plain_text", "text": "下書き作成"}, "url": "<gasWebAppUrl>?action=createDraft&id=<uuid>", "style": "primary"}
    ]},
    {"type": "divider"},
    {"type": "section", "text": {"type": "mrkdwn", "text": "*2. [件名]* \n差出人: 名前 | 受信: YYYY-MM-DD HH:MM\n\n具体的な内容..."}},
    {"type": "actions", "elements": [
      {"type": "button", "text": {"type": "plain_text", "text": "Gmailで開く"}, "url": "https://mail.google.com/mail/u/0/#inbox/<messageId>"}
    ]}
  ]
}
```

- 新着0件 → 通知しない
- 10件超 → 件名+差出人のリストに縮退し、末尾に「他N件」と記載
- Slack 5000文字制限に注意
- 返信不要と判断したメールには「下書き作成」ボタンを付けない（「Gmailで開く」のみ）
- 返信案がある場合、引用ブロック（`>`）で冒頭1-2行をプレビュー表示する
- `gasWebAppUrl` が未設定の場合は、`accessory` 形式で「Gmailで開く」ボタンのみ表示する:
  ```json
  {"type": "section", "text": {"type": "mrkdwn", "text": "..."}, "accessory": {"type": "button", "text": {"type": "plain_text", "text": "Gmailで開く"}, "url": "https://mail.google.com/mail/u/0/#inbox/<messageId>"}}
  ```
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
  "cronMinute": 55,
  "gasWebAppUrl": "https://script.google.com/macros/s/XXXX/exec",
  "gasAuthToken": "ランダムトークン"
}
```

- `gasWebAppUrl` / `gasAuthToken` はオプション。未設定の場合、返信案生成とワンクリック下書きボタンはスキップされ、従来通りの動作となる。

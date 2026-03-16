# Claude Gmail Slack Notifier

Claude Codeを使って、Gmailの新着メールを定期的にチェックし、Slackにサマリーを通知する仕組み。

## 仕組み

- Claude Codeセッション起動時に、前回チェック以降の未読メールを一括取得してSlackに通知
- セッション中は毎時自動チェック（CronCreate）
- 通知対象のメールフィルタはセットアップ時に対話でカスタマイズ可能
- 通知先: Slack Incoming Webhook（Bot/アプリとして送信）

## 前提条件

- [Claude Code](https://docs.anthropic.com/en/docs/claude-code) がインストール済み

## セットアップ

### 1. リポジトリをクローン

```bash
git clone https://github.com/RyosukeArima/claude-gmail-slack-notifier.git
cd claude-gmail-slack-notifier
```

### 2. Gmail MCPを有効化

Claude CodeからGmailを読み取るために、Gmail MCPの有効化が必要です。

1. Claude Codeの設定画面を開く（`/settings` またはClaude Desktop → Settings）
2. 「Integrations」セクションを開く
3. 「Gmail」を有効化し、Googleアカウントで認証する

### 3. Slack Incoming Webhookを取得

通知の送信先となるSlack Webhook URLを作成します。

1. [Slack App管理ページ](https://api.slack.com/apps) を開く
2. 右上の「Create New App」→「From scratch」を選択
3. App名を入力（例: `Gmail Notifier`）、ワークスペースを選んで「Create App」
4. 左メニューの「Incoming Webhooks」をクリック → 右上のトグルを「On」にする
5. ページ下部の「Add New Webhook to Workspace」→ 通知先チャンネルを選択 →「許可する」
6. 生成されたWebhook URL（`https://hooks.slack.com/services/...` の形式）をコピー

### 4. Slack User IDを取得

通知メッセージでメンションするために、あなたのSlack User IDが必要です。

1. Slackアプリで自分のプロフィールを開く
2. 「...」メニュー →「メンバーIDをコピー」

### 5. 環境変数を設定

取得した値をシェルの設定ファイルに追記します。

```bash
echo 'export SLACK_WEBHOOK_URL="取得したWebhook URL"' >> ~/.zshrc
echo 'export SLACK_USER_ID="取得したUser ID"' >> ~/.zshrc
source ~/.zshrc
```

### 6. Claude Codeを起動

```bash
claude
```

セッション開始後、最初に何か一言送ると（「ok」等で十分）、自動でメールチェックとCronジョブ登録が行われます。

環境変数が未設定の場合は対話型セットアップウィザードが起動し、上記の手順を案内します。

## 使い方

### 自動通知

セッション起動後は毎時自動チェックされるので、セッションを開いたままにしておけばOK。

### 手動チェック

```
/mail-check
```

### フィルタ再設定

```
/mail-setup
```

### 返信の下書き作成

Slack通知の番号を使って依頼:

```
3番の返信下書き作って
```

Claude Codeが `gmail_create_draft` で下書きを生成する。

## 動作ライフサイクル

| シナリオ | Cronジョブ | 最終チェック時刻 | 対応 |
|---|---|---|---|
| スリープ→復帰（セッション生存中） | 生存 | 保持 | 次の定期チェックで自動再開 |
| ターミナル閉じ / セッション切れ | 消失 | ディスクに残る | `claude` 再起動で自動復旧 |
| 3日間連続起動（自動失効） | 消失 | 保持 | 同上 |
| 数日間起動なし | なし | 保持 | 起動時に一括キャッチアップ |

## ファイル構成

```
claude-gmail-slack-notifier/
├── .claude/
│   ├── CLAUDE.md              # セッション自動処理の指示
│   └── commands/
│       ├── mail-setup.md      # /mail-setup セットアップウィザード
│       └── mail-check.md      # /mail-check 手動チェック
├── .gitignore
├── README.md
├── config.json                # メールフィルタ設定（自動生成、gitignore対象）
└── state.json                 # 最終チェック時刻（自動生成、gitignore対象）
```

## 制約

- Claude Codeセッションが起動していないと通知は来ない
- Cronジョブはセッション内のみ有効（3日で自動失効、次回起動時に再登録）
- Gmail検索の `after:` は日付単位のため、同日内のチェックはタイムスタンプ比較で補完

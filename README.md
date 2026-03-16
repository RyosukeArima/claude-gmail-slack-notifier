# Mail Notification

Claude Codeを使って、Gmailの新着メールを定期的にチェックし、Slackにサマリーを通知する仕組み。

## 仕組み

- Claude Codeセッション起動時に、前回チェック以降の未読メールを一括取得してSlackに通知
- セッション中は毎時自動チェック（CronCreate）
- 通知対象のメールフィルタはセットアップ時に対話でカスタマイズ可能
- 通知先: Slack Incoming Webhook（Bot/アプリとして送信）

## 前提条件

- [Claude Code](https://docs.anthropic.com/en/docs/claude-code) がインストール済み
- Claude CodeのGmail MCPが有効（未設定の場合、セットアップウィザードが案内します）

## セットアップ

```bash
git clone <this-repo>
cd mailNotification
claude
```

**Claude Codeを起動するだけで、対話型セットアップウィザードが自動で始まります。**

ウィザードが案内する内容:
1. Slack App作成 + Incoming Webhook設定
2. 環境変数の設定（`SLACK_WEBHOOK_URL`, `SLACK_USER_ID`）
3. 通知対象メールのフィルタ設定（実際のメールを見ながらカスタマイズ）
4. 接続テスト + 初回メールチェック + Cronジョブ登録

## 使い方

### 自動通知

セッション起動後、最初に何か一言送ると（「ok」等で十分）、自動でキャッチアップとCronジョブ登録が行われる。
以降は毎時自動チェックされるので、セッションを開いたままにしておけばOK。

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
mailNotification/
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

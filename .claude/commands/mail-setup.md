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
3. 成功を確認したら、~/.zshrc に追記し、現在のセッションにも反映する:
   ```bash
   echo 'export SLACK_WEBHOOK_URL="受け取ったURL"' >> ~/.zshrc
   export SLACK_WEBHOOK_URL="受け取ったURL"
   ```

## Step 5: Slack User ID

1. 「次に、あなたのSlack User IDが必要です。Slackで自分のプロフィールを開いて、『...』メニュー →『メンバーIDをコピー』で取得できます。コピーしたらここに貼ってください。」
2. 受け取ったIDを ~/.zshrc に追記し、現在のセッションにも反映する:
   ```bash
   echo 'export SLACK_USER_ID="受け取ったID"' >> ~/.zshrc
   export SLACK_USER_ID="受け取ったID"
   ```

## Step 6: メールフィルタの設定

ユーザーにどんなメールを通知対象にしたいかを対話で聞き、Gmailの検索クエリを組み立てる。
CLAUDE.md のStep 7（メールフィルタの設定）と同じ手順に従う。

## Step 7: ワンクリック下書き機能（オプション）

ユーザーに聞く: 「Slackの通知にワンクリックで返信下書きを作成するボタンを追加できます。Google Apps Scriptを使います。設定しますか？（スキップ可能）」

スキップする場合 → Step 8へ進む。

### clasp が使える場合（自動セットアップ）

1. `which clasp` で clasp の存在を確認する。なければ `npm install -g @google/clasp` を案内する。
2. `clasp login --status` またはクレデンシャルファイルの存在を確認する。未ログインなら `clasp login` を実行する（ブラウザが開く）。
3. `gas/` ディレクトリで以下を実行:
   ```bash
   cd gas/
   clasp create --title "Gmail Draft Creator" --type standalone
   clasp push --force
   clasp create-deployment --description "v1"
   ```
4. `clasp list-deployments` でデプロイIDを取得し、デプロイURLを組み立てる:
   - 形式: `https://script.google.com/macros/s/<デプロイID>/exec`
5. ランダムな認証トークンを生成する: `openssl rand -hex 32`
6. 権限承認 + AUTH_TOKEN設定のURLを生成し、ユーザーに案内する:
   ```
   以下のURLをブラウザで開いてください。Gmailへのアクセス許可が求められたら承認してください:
   <デプロイURL>?action=setup&token=<生成したトークン>
   ```
7. ユーザーが承認完了を報告したら、`config.json` に保存する:
   ```json
   {
     "gasWebAppUrl": "<デプロイURL>",
     "gasAuthToken": "<生成したトークン>"
   }
   ```
8. テスト: GASにテストデータを保存して確認する:
   ```bash
   DATA=$(echo -n '{"messageId":"test","subject":"テスト","replyBody":"テスト返信"}' | base64 | tr -d '\n')
   curl -sL -G "<デプロイURL>" \
     --data-urlencode "action=save" \
     --data-urlencode "token=<生成したトークン>" \
     --data-urlencode "id=test-setup" \
     --data-urlencode "data=${DATA}"
   ```
   レスポンスHTMLに「保存完了」が含まれていれば成功。

**注意: `clasp create-deployment` 後にコードを更新した場合は `clasp push --force && clasp update-deployment <デプロイID>` で既存デプロイを更新すること。`create-deployment` を再実行すると別URLになる。**

### clasp がない場合（手動セットアップ）

以下を1つずつ案内する:

1. 「https://script.google.com を開いて、『新しいプロジェクト』を作成してください。」
2. 「プロジェクト名を入力してください（例: Gmail Draft Creator）。」
3. 「エディタに表示されている `Code.gs` の中身を全て消して、以下の内容を貼り付けてください。」
   → プロジェクト内の `gas/Code.gs` の内容を表示する。
4. 「次に、`appsscript.json` を編集します。左メニューの歯車アイコン（プロジェクトの設定）を開き、『「appsscript.json」マニフェスト ファイルをエディタで表示する』にチェックを入れてください。」
5. 「エディタに戻ると `appsscript.json` が表示されるので、中身を以下に置き換えてください。」
   → プロジェクト内の `gas/appsscript.json` の内容を表示する。
6. 「右上の『デプロイ』→『新しいデプロイ』を選んでください。」
7. 「歯車アイコン →『ウェブアプリ』を選択。『次のユーザーとして実行』を『自分』、『アクセスできるユーザー』を『全員』にして『デプロイ』を押してください。」
8. 「初回はGmailへのアクセス許可が求められます。『権限を確認』→ Googleアカウントを選択 →『詳細』→『安全でないページに移動』→『許可』を押してください。」
9. 「表示されたウェブアプリのURL（https://script.google.com/macros/s/.../exec の形式）をコピーして、ここに貼り付けてください。」

URLを受け取ったら:
1. ランダムな認証トークンを生成する（`openssl rand -hex 32`）。
2. setupエンドポイントでAUTH_TOKENを設定するURLを生成し、ユーザーに案内する:
   ```
   以下のURLをブラウザで開いてください:
   <受け取ったURL>?action=setup&token=<生成したトークン>
   ```
3. ユーザーが完了を報告したら、`config.json` に保存する:
   ```json
   {
     "gasWebAppUrl": "<受け取ったURL>",
     "gasAuthToken": "<生成したトークン>"
   }
   ```
4. テスト: 上記のclaspセクションと同じcurlコマンドで確認する。

## Step 8: 初回メールチェック

CLAUDE.md の「メールキャッチアップ」手順（1〜6）を実行する。
Slackに通知が届いたことをユーザーに確認する。新着0件の場合は「新着メールはありませんでした。」と伝える。

## Step 9: Cronジョブ登録

CLAUDE.md の「Cronジョブ登録」手順に従い、毎時のジョブを登録する。

## Step 10: 完了

以下を伝える:
```
セットアップ完了です。

- Slack通知: 毎時自動チェック
- 手動チェック: /mail-check でいつでも実行可能
- フィルタ変更: /mail-setup でいつでも再設定可能
- 返信の下書き: 通知の「下書き作成」ボタンでワンクリック作成（GAS設定済みの場合）
- 次回起動時: 自動でキャッチアップ + Cron再登録されます

※ Cronジョブはこのセッション中のみ有効です（最大3日）。
  セッション切れ後もClaude Code再起動で自動復旧します。
```

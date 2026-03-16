/**
 * Gmail Draft Creator - Google Apps Script Web App
 *
 * Claude Code がメールチェック時に生成した返信案を保存し、
 * Slack のボタンからワンクリックで Gmail 下書きを作成する。
 *
 * PropertiesService にデータを保持（Spreadsheet不要）。
 * スクリプトプロパティ AUTH_TOKEN で書き込みを認証する。
 *
 * 全てdoGetで処理する（Google Workspace環境ではdoPostのContentService
 * レスポンスが組織外からブロックされるため）。
 */

// ---------------------------------------------------------------------------
// doGet: 全リクエストのエントリポイント
//   ?action=save&token=XXX&id=UUID&data=BASE64 ... 返信案の保存（UUID はClaude Code側で生成）
//   ?action=createDraft&id=UUID           ... 下書き作成
//   ?action=setup&token=XXX               ... AUTH_TOKEN初期設定
// ---------------------------------------------------------------------------
function doGet(e) {
  var action = (e.parameter.action || '').toString();

  if (action === 'setup') {
    return handleSetup(e);
  }

  if (action === 'save') {
    return handleSave(e);
  }

  if (action === 'createDraft') {
    return handleCreateDraft(e);
  }

  return htmlResponse('無効なリクエストです。', false);
}

// ---------------------------------------------------------------------------
// save: Claude Code → 返信案を PropertiesService に保存
//   ?action=save&token=AUTH_TOKEN&data=BASE64エンコードされたJSON
//   data の中身: {"items":[{"messageId":"...","subject":"...","replyBody":"..."}]}
//   レスポンス: UUIDリストを含むHTML
// ---------------------------------------------------------------------------
function handleSave(e) {
  try {
    var props = PropertiesService.getScriptProperties();
    var token = props.getProperty('AUTH_TOKEN');
    var reqToken = (e.parameter.token || '').toString();

    if (!token || reqToken !== token) {
      return htmlResponse('Unauthorized', false);
    }

    var dataB64 = (e.parameter.data || '').toString();
    if (!dataB64) {
      return htmlResponse('dataパラメータが必要です。', false);
    }

    var uuid = (e.parameter.id || '').toString();
    if (!uuid) {
      return htmlResponse('idパラメータが必要です。', false);
    }

    var payload = JSON.parse(Utilities.newBlob(Utilities.base64Decode(dataB64)).getDataAsString());

    props.setProperty(uuid, JSON.stringify({
      messageId: payload.messageId,
      subject: payload.subject || '',
      replyBody: payload.replyBody,
      createdAt: new Date().toISOString()
    }));

    // 3日超過のエントリを掃除
    cleanup(props);

    return htmlResponse('<b>保存完了</b>', true);
  } catch (err) {
    return htmlResponse('保存エラー: ' + escapeHtml(err.message), false);
  }
}

// ---------------------------------------------------------------------------
// createDraft: Slack ボタン → 下書き作成 → プロパティ削除
// ---------------------------------------------------------------------------
function handleCreateDraft(e) {
  var uuid = (e.parameter.id || '').toString();

  if (!uuid) {
    return htmlResponse('IDが指定されていません。', false);
  }

  var props = PropertiesService.getScriptProperties();
  var raw = props.getProperty(uuid);

  if (!raw) {
    return htmlResponse('このリンクは既に使用済みか、存在しません。', false);
  }

  var data = JSON.parse(raw);

  try {
    var message = GmailApp.getMessageById(data.messageId);
    if (!message) {
      return htmlResponse('メールが見つかりませんでした。', false);
    }

    message.createDraftReply(data.replyBody);

    // ワンタイム: 使用済みなので削除
    props.deleteProperty(uuid);

    return htmlResponse(
      '下書きを作成しました。<br><br>'
      + '<b>件名:</b> Re: ' + escapeHtml(data.subject) + '<br>'
      + '<b>内容:</b><br>' + escapeHtml(data.replyBody).replace(/\n/g, '<br>'),
      true
    );
  } catch (err) {
    return htmlResponse('下書き作成に失敗しました: ' + escapeHtml(err.message), false);
  }
}

// ---------------------------------------------------------------------------
// setup: AUTH_TOKEN の初期設定（1回のみ）
// ---------------------------------------------------------------------------
function handleSetup(e) {
  var newToken = (e.parameter.token || '').toString();
  if (!newToken) {
    return htmlResponse('tokenパラメータが必要です。', false);
  }
  var props = PropertiesService.getScriptProperties();
  var existing = props.getProperty('AUTH_TOKEN');
  if (existing) {
    return htmlResponse('AUTH_TOKENは既に設定済みです。再設定するには、スクリプトエディタからプロパティを削除してください。', false);
  }
  props.setProperty('AUTH_TOKEN', newToken);
  return htmlResponse('AUTH_TOKENを設定しました。このURLは今後使用しないでください。', true);
}

// ---------------------------------------------------------------------------
// クリーンアップ: 3日超過のエントリを削除
// ---------------------------------------------------------------------------
var EXPIRY_MS = 3 * 24 * 60 * 60 * 1000;

function cleanup(props) {
  var all = props.getProperties();
  var now = new Date().getTime();

  Object.keys(all).forEach(function(key) {
    if (key === 'AUTH_TOKEN') return;
    try {
      var data = JSON.parse(all[key]);
      if (data.createdAt && (now - new Date(data.createdAt).getTime()) > EXPIRY_MS) {
        props.deleteProperty(key);
      }
    } catch (e) {
      // JSON パース失敗 = 不正エントリなので削除
      props.deleteProperty(key);
    }
  });
}

// ---------------------------------------------------------------------------
// ヘルパー
// ---------------------------------------------------------------------------
function htmlResponse(message, success) {
  var color = success ? '#2ea44f' : '#d73a49';
  var icon = success ? '&#10003;' : '&#10007;';
  var html = '<!DOCTYPE html><html><head><meta charset="utf-8">'
    + '<meta name="viewport" content="width=device-width,initial-scale=1">'
    + '<title>Gmail Draft Creator</title>'
    + '<style>'
    + 'body{font-family:-apple-system,BlinkMacSystemFont,sans-serif;display:flex;justify-content:center;align-items:center;min-height:100vh;margin:0;background:#f6f8fa;}'
    + '.card{background:#fff;border-radius:12px;padding:32px;max-width:480px;width:90%;box-shadow:0 1px 3px rgba(0,0,0,.12);text-align:center;}'
    + '.icon{font-size:48px;color:' + color + ';margin-bottom:16px;}'
    + '.msg{font-size:15px;color:#24292f;line-height:1.6;text-align:left;}'
    + '</style></head><body>'
    + '<div class="card">'
    + '<div class="icon">' + icon + '</div>'
    + '<div class="msg">' + message + '</div>'
    + '</div></body></html>';

  return HtmlService.createHtmlOutput(html);
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

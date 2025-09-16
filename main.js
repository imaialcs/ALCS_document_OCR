// main.js
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const { app, BrowserWindow, Menu, ipcMain, dialog } = require('electron');
const log = require('electron-log');
const { GoogleGenAI } = require('@google/genai');

// Gemini OCR処理を実行するためのIPCハンドラ
ipcMain.handle('invoke-gemini-ocr', async (event, pages) => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    throw new Error("APIキーが見つかりません。'.env'ファイルで'API_KEY'が設定されているか確認してください。");
  }

  const ai = new GoogleGenAI({ apiKey });
  const allProcessedData = [];

  for (const page of pages) {
    const filePart = {
      inlineData: {
        data: page.base64,
        mimeType: page.mimeType,
      },
    };

    const prompt = `あなたは、紙の文書をデジタル化する超高精度なOCRエキスパートです。与えられた画像からテキストを正確に抽出し、指示されたJSON形式で構造化する任務を担います。いかなる場合でも、指定されたJSONスキーマに100%準拠した有効なJSON配列のみを出力してください。

# 思考プロセス
1.  まず、画像全体を注意深く観察し、文書のタイプを「タイムカード」「一般的なテーブル」「文字起こし」のいずれかであるか判断します。
    - **タイムカード**: 「出勤」「退勤」「始業」「終業」などのキーワードや、日付と時刻のペアが並んだ典型的な勤怠管理票のレイアウトを持つもの。
    - **一般的なテーブル**: タイムカード以外の、明確な行と列を持つ構造化された帳票（請求書、通帳など）。
    - **文字起こし**: 手紙、メモ、記事など、自由な形式の文章。
2.  判断したタイプに応じて、以下の各セクションのルールに従い、厳格にJSONオブジェクトを生成します。

# 全体ルール
- **最重要**: 出力は、必ず指定されたJSONスキーマに準拠したJSON配列 **のみ** としてください。説明、挨拶、マークダウン(\`json ... \`)は絶対に含めないでください。
- 文書が読み取れない、または内容が空の場合でも、必ず空の配列  \`[]\`  を返してください。エラーメッセージや説明はJSONに含めてはいけません。
- 画像内に複数の独立した文書がある場合は、それぞれをJSON配列内の個別のオブジェクトとして処理してください。
- ハンコや印鑑の文字も、読み取れる場合はテキストとして転記してください。

---

# 1. タイムカード形式の場合
- **\`type\`**: 必ず \`"timecard"\` とします。
- **\`title\`**:
    - **\`yearMonth\`**: 文書全体の年月（例: 「2025年 8月」）を抽出します。見つからなければ空文字列 \`""\` とします。
    - **\`name\`**: 氏名を抽出します。見つからなければ空文字列 \`""\` とします。
- **\`days\`**: 日ごとの勤怠データをオブジェクトの配列として格納します。
    - **\`date\`**: 日付 (例: "1", "2")。
    - **\`dayOfWeek\`**: 曜日 (例: "月", "火")。
    - **\`morningStart\`**: 午前の始業時刻。印字がなければ \`null\`。
    - **\`morningEnd\`**: 午前の終業時刻。印字がなければ \`null\`。
    - **\`afternoonStart\`**: 午後の始業時刻。印字がなければ \`null\`。
    - **\`afternoonEnd\`**: 午後の終業時刻。印字がなければ \`null\`。
- **【重要】時刻の解釈**:
    - タイムカードの時刻は、左から順番に「午前の始業」「午前の終了」「午後の始業」「午後の終了」に対応します。
    - **午前勤務のみ（2打刻）**: 最初の2つの時刻を \`morningStart\` と \`morningEnd\` に割り当て、\`afternoonStart\` と \`afternoonEnd\` は \`null\` にします。
    - **午後勤務のみ（2打刻）**: 最初の2つの時刻を \`afternoonStart\` と \`afternoonEnd\` に割り当て、\`morningStart\` と \`morningEnd\` は \`null\` にします。（※この判断は難しいですが、時刻が明らかに午後（例: 13:00以降）から始まっている場合に適用してください）
    - **4打刻**: 4つの時刻を順番に割り当てます。
    - 印字されていない時刻や空白のセルは、必ず \`null\` を設定してください。

---
**タイムカード形式の出力例:**
\`\`\`json
[
  {
    "type": "timecard",
    "title": {
      "yearMonth": "2025年 8月",
      "name": "石塚 萌"
    },
    "days": [
      {
        "date": "1",
        "dayOfWeek": "月",
        "morningStart": "09:02",
        "morningEnd": "12:05",
        "afternoonStart": "13:01",
        "afternoonEnd": "18:08"
      },
      {
        "date": "2",
        "dayOfWeek": "火",
        "morningStart": "09:05",
        "morningEnd": "12:00",
        "afternoonStart": null,
        "afternoonEnd": null
      }
    ]
  }
]
\`\`\`
---

# 2. 一般的なテーブル形式の場合
- **\`type\`**: 必ず \`"table"\` とします。
- **\`title\`**:
    - **\`yearMonth\`**: 文書全体の年月を抽出します。見つからなければ \`""\`。
    - **\`name\`**: 氏名や件名など、文書の主題を抽出します。見つからなければ \`""\`。
- **\`headers\`**: データの列ヘッダーを文字列の配列として抽出します。
- **\`data\`**:
    - 各データ行を、文字列の配列に変換します。
    - **見たままを転記**: 文字、数字、記号を一切変更せず、画像に表示されている通りに転記します。
    - **空白セル**: 空白に見えるセルは、空文字列 \`""\` で表現します。
    - **列数の一致**: 各データ行の要素数は、必ず \`headers\` 配列の要素数と一致させてください。

---
**一般的なテーブル形式の出力例:**
\`\`\`json
[
  {
    "type": "table",
    "title": {
      "yearMonth": "2025年 8月",
      "name": "請求書"
    },
    "headers": ["日付", "品目", "単価", "数量", "金額"],
    "data": [
      ["8/1", "商品A", "1000", "2", "2000"],
      ["8/3", "商品B", "1500", "1", "1500"]
    ]
  }
]
\`\`\`
---

# 3. 文字起こし形式の場合
- **\`type\`**: 必ず \`"transcription"\` とします。
- **\`fileName\`**: この文書のファイル名です。常に \`'${page.name}'\` を設定してください。
- **\`content\`**: 文書内のすべてのテキストを、改行や段落も含めて一つの文字列として書き起こします。

---
**文字起こし形式の出力例:**
\`\`\`json
[
  {
    "type": "transcription",
    "fileName": "memo.jpg",
    "content": "来週の会議について\\n\\n日時: 9月16日(火) 10:00~\\n場所: 第3会議室"
  }
]
\`\`\`
---

# 最終確認
- 出力は有効なJSON配列ですか？
- 判断したタイプに応じた正しいスキーマを使用していますか？
- 説明や余分なテキストは含まれていませんか？

これらの指示を厳格に守り、最高の精度でOCR処理を実行してください。
`;

    const textPart = { text: prompt };

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-pro",
            contents: { parts: [filePart, textPart] },
        });

        if (!response.text) {
            console.error("APIからの応答にテキストデータが含まれていませんでした。");
            continue;
        }

        let jsonString = response.text.trim();
        
        const arrayStart = jsonString.indexOf('[');
        const arrayEnd = jsonString.lastIndexOf(']');
        
        if (arrayStart !== -1 && arrayEnd !== -1) {
          jsonString = jsonString.substring(arrayStart, arrayEnd + 1);
        } else {
          const objectStart = jsonString.indexOf('{');
          const objectEnd = jsonString.lastIndexOf('}');
          if (objectStart !== -1 && objectEnd !== -1) {
              jsonString = jsonString.substring(objectStart, objectEnd + 1);
          }
        }

        try {
          const parsedData = JSON.parse(jsonString);
          if (Array.isArray(parsedData)) {
              const isValid = parsedData.every(item =>
                  (item.type === 'table' && 'headers' in item && 'data' in item) ||
                  (item.type === 'transcription' && 'content' in item) ||
                  (item.type === 'timecard' && 'days' in item) // タイムカード形式の検証を追加
              );
              if (isValid) {
                  allProcessedData.push(...parsedData);
              } else {
                // データ構造が一致しない場合でも、とりあえずフロントに送ってデバッグしやすくする
                console.warn("API returned data that did not fully match structure for a page:", parsedData);
                allProcessedData.push(...parsedData);
              }
          } else {
            console.warn("API returned a non-array response for a page:", parsedData);
          }
        } catch (e) {
          console.error("Failed to parse JSON response for a page:", e);
          console.error("Received response string for page:", jsonString);
        }
    } catch (apiError) {
        console.error("Gemini API call failed for a page:", apiError);
        throw new Error(`Gemini APIの呼び出しに失敗しました: ${apiError.message}`);
    }
  }
  return allProcessedData;
});

// ファイル保存ダイアログを表示してファイルを保存するためのIPCハンドラ
ipcMain.handle('save-file', async (event, options, data) => {
  const { defaultPath } = options;
  const focusedWindow = BrowserWindow.fromWebContents(event.sender);

  if (!focusedWindow) {
    return { success: false, error: 'Could not find the browser window.' };
  }

  try {
    const { canceled, filePath } = await dialog.showSaveDialog(focusedWindow, {
      defaultPath: defaultPath,
    });

    if (canceled || !filePath) {
      return { success: false, canceled: true };
    }

    fs.writeFileSync(filePath, Buffer.from(data));
    return { success: true, path: filePath };
  } catch (error) {
    console.error('Failed to save file:', error);
    return { success: false, error: error.message };
  }
});

// メニューテンプレートを定義
const template = [
  {
    label: 'ファイル',
    submenu: [
      {
        label: '終了',
        role: 'quit'
      }
    ]
  },
  {
    label: '編集',
    submenu: [
      {
        label: '元に戻す',
        role: 'undo'
      },
      {
        label: 'やり直す',
        role: 'redo'
      },
      { type: 'separator' },
      {
        label: '切り取り',
        role: 'cut'
      },
      {
        label: 'コピー',
        role: 'copy'
      },
      {
        label: '貼り付け',
        role: 'paste'
      },
      {
        label: 'すべて選択',
        role: 'selectAll'
      }
    ]
  },
  {
    label: '表示',
    submenu: [
      {
        label: '拡大',
        role: 'zoomIn'
      },
      {
        label: '縮小',
        role: 'zoomOut'
      },
      {
        label: '拡大率のリセット',
        role: 'resetZoom'
      },
      { type: 'separator' },
      {
        label: '全画面表示',
        role: 'togglefullscreen'
      }
    ]
  },
  {
    label: 'ヘルプ',
    submenu: [
      {
        label: 'バージョン情報',
        click: async () => {
          const { dialog } = require('electron');
          await dialog.showMessageBox({
            title: 'バージョン情報',
            message: '文書OCR',
            detail: `バージョン: ${app.getVersion()}\\n© 2025 ALCS`
          });
        }
      }
    ]
  }
];

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    icon: path.join(__dirname, 'icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  // メニューを設定
  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);

  mainWindow.loadFile('dist/index.html');
}

app.whenReady().then(() => {
  createWindow();

  // 自動更新の確認
  const { autoUpdater } = require('electron-updater');
  autoUpdater.logger = log;
  autoUpdater.logger.transports.file.level = 'info';
  log.info('App starting...');
  autoUpdater.checkForUpdatesAndNotify();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});

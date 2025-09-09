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

    const prompt = `あなたは高度なOCRエンジンです。画像やPDFからテキストを抽出し、その内容に応じて最適な形式で出力します。

# 全体ルール
- **最重要**: 何があっても、指定されたJSONスキーマに100%準拠した有効なJSON配列のみを出力してください。
- 文書が読み取れない、または内容が空の場合でも、必ず空の配列 '[]' を返してください。エラーメッセージや説明は絶対にJSONに含めないでください。
- まず、文書の種類を「テーブル形式」か「文字起こし形式」か判断してください。
  - **テーブル形式**: タイムカード、通帳、請求書など、行と列で構成される構造化された帳票。
  - **文字起こし形式**: 手紙、メモ、記事など、特定の構造を持たない一般的な文章。
- 画像に複数の文書がある場合、それぞれをJSON配列内の個別のオブジェクトとしてください。
- 説明、挨拶、マークダウン('json'など)は絶対に含めないでください。

# 1. テーブル形式の場合の処理ルール
- 'type': 必ず '"table"' という文字列を設定します。
- 'title':
    - 'yearMonth': 文書全体の年月（例: 「2025年 8月」）を抽出します。なければ空文字列 '""'。
    - 'name': 氏名や件名など、文書の主題を抽出します。なければ空文字列 '""'。
- 'headers':
    - データの列ヘッダー（例: 「日」「出勤」「退勤」）を文字列の配列として抽出します。
- 'data':
    - 各データ行を、文字列の配列に変換します。
    - **見たままを転記**: 文字、数字、記号を一切変更せずにそのまま転記します。特に、9:05や8:00のような時間や、1.00のような数字は、欠落させずに必ず文字列として含めてください。
    - **空白のセル**: 空白のセルは空文字列 '""' にします。
    - **行の列数を統一**: 各データ行の要素数は、必ず 'headers' 配列の要素数と一致させてください。足りない場合は '""' で埋めてください。
    - 'data' は、必ず **文字列の配列の配列 ('string[][]')** となるようにしてください。

# 2. 文字起こし形式の場合の処理ルール
- 'type': 必ず '"transcription"' という文字列を設定します。
- 'fileName': この文書のファイル名です。常に '${page.name}' を設定してください。
- 'content':
    - 文書内のすべてのテキストを、改行も含めて一つの文字列として書き起こします。
    - 見たままを忠実に再現してください。`;

    const textPart = { text: prompt };

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
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
                  (item.type === 'transcription' && 'content' in item)
              );
              if (isValid) {
                  allProcessedData.push(...parsedData);
              } else {
                console.warn("API returned data that did not fully match structure for a page:", parsedData);
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
            detail: `バージョン: ${app.getVersion()}\n© 2025 ALCS`
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
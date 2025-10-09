// main.js
const { app, BrowserWindow, Menu, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { autoUpdater } = require('electron-updater');
const log = require('electron-log');
const Jimp = require('jimp'); // Add Jimp import
const { Buffer } = require('buffer'); // Add Buffer import
const fetch = require('node-fetch');

// Initialize electron-log to capture renderer console
log.initialize({ spyRendererConsole: true });
const { GoogleGenAI } = require('@google/genai');
const { spawn } = require('child_process');
const os = require('os');
const { v4: uuidv4 } = require('uuid');

// --- Environment and Configuration ---
require('dotenv').config({ path: path.join(app.getAppPath(), '.env') });
const isDev = !app.isPackaged;

// Configure logging
autoUpdater.logger = log;
log.transports.file.level = 'info';
log.info('App starting...');

let mainWindow;

// --- Main Window Creation ---
function createWindow() {
  const preloadPath = path.join(__dirname, 'dist', 'preload.js');

  log.info(`Resolved preloadPath: ${preloadPath}`); // この行を追加

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: preloadPath, // ここで切り替えたパスを使用
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  const devServerUrl = process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173';
  const startUrl = isDev
    ? devServerUrl
    : `file://${path.join(__dirname, 'dist', 'index.html')}`;
  
  mainWindow.loadURL(startUrl);

  if (isDev) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => mainWindow = null);
}

// --- Application Menu ---
const createMenu = () => {
  const template = [
    {
      label: 'ファイル',
      submenu: [
        { role: 'quit', label: '終了' }
      ]
    },
    {
      label: '表示',
      submenu: [
        { role: 'reload', label: 'リロード' },
        { role: 'forceReload', label: '強制的にリロード' },
        { role: 'toggleDevTools', label: '開発者ツールを表示' },
        { type: 'separator' },
        { role: 'resetZoom', label: '実際のサイズ' },
        { role: 'zoomIn', label: '拡大' },
        { role: 'zoomOut', label: '縮小' },
      ]
    },
    {
      label: 'ヘルプ',
      submenu: [
        {
          label: 'バージョン情報',
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'バージョン情報',
              message: `ALCS文書OCR\nバージョン: ${app.getVersion()}\nElectron: ${process.versions.electron}\nNode: ${process.versions.node}`,
            });
          }
        },
        {
          label: '更新を確認',
          click: () => {
            autoUpdater.checkForUpdatesAndNotify();
            if (mainWindow) {
              mainWindow.webContents.send('show-update-notification');
            }
          }
        }
      ]
    }
  ];
  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
};

// --- App Lifecycle ---
app.on('ready', () => {
  createWindow();
  createMenu();
  // Check for updates 2 seconds after app is ready
  setTimeout(() => autoUpdater.checkForUpdatesAndNotify(), 2000);

  // Electronのデフォルトコンテキストメニューを無効化
  mainWindow.webContents.on('context-menu', (e, params) => {
    // e.preventDefault(); // この行を削除して、レンダラー側でイベントを処理できるようにする
  });

  ipcMain.on('show-context-menu', (event) => {
    const template = [
      {
        label: 'バージョン情報',
        click: () => {
          dialog.showMessageBox(mainWindow, {
            type: 'info',
            title: 'バージョン情報',
            message: `ALCS文書OCR\nバージョン: ${app.getVersion()}`,
          });
        }
      },
      {
        label: '更新を確認',
        click: () => {
          autoUpdater.checkForUpdatesAndNotify();
        }
      },
      { type: 'separator' },
      { role: 'reload', label: 'リロード' },
      { role: 'toggleDevTools', label: '開発者ツール' },
    ];
    const menu = Menu.buildFromTemplate(template);
    menu.popup({ window: BrowserWindow.fromWebContents(event.sender) });
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

// --- Auto-updater Event Handlers ---
const sendUpdateStatus = (status) => {
  log.info(status);
  if (mainWindow) {
    mainWindow.webContents.send('update-status', status);
  }
};

autoUpdater.on('update-downloaded', () => sendUpdateStatus({ message: 'アップデートの準備ができました。アプリケーションを再起動してください。', ready: true }));

ipcMain.on('restart-app', () => {
  autoUpdater.quitAndInstall();
});

// --- Data Validation Function ---
const validateData = (data) => {
  const errors = {};

  // Helper to parse numbers from strings like "1,000円"
  const parseNumber = (value) => {
    if (typeof value === 'number') return value;
    if (typeof value !== 'string') return NaN;
    return parseFloat(value.replace(/[^0-9.-]+/g, ''));
  };

  // 1. 日付形式チェック (YYYY-MM-DD or YYYY/MM/DD)
  const dateKeys = ['発行日', '日付'];
  dateKeys.forEach(key => {
    if (data[key]) {
      const dateStr = String(data[key]);
      // 簡易的な正規表現でチェック
      if (!/^\d{4}[-\/]\d{1,2}[-\/]\d{1,2}$/.test(dateStr)) {
        // より厳密なチェック (e.g. new Date())
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) {
            errors[key] = '無効な日付形式です。';
        }
      }
    }
  });

  // 2. 数値計算チェック (小計 + 消費税 = 合計金額)
  if ('小計' in data && '消費税' in data && '合計金額' in data) {
    const subtotal = parseNumber(data['小計']);
    const tax = parseNumber(data['消費税']);
    const total = parseNumber(data['合計金額']);

    if (!isNaN(subtotal) && !isNaN(tax) && !isNaN(total)) {
      if (Math.abs((subtotal + tax) - total) > 0.01) { // 浮動小数点誤差を考慮
        errors['合計金額'] = `計算が合いません (小計${subtotal} + 消費税${tax} = ${subtotal + tax} となります)。`;
      }
    }
  }

  // 3. 必須項目チェック
  const requiredKeys = ['請求元', '支払先', '合計金額'];
  requiredKeys.forEach(key => {
    if (data[key] === null || data[key] === '' || data[key] === undefined) {
      errors[key] = '必須項目が空です。';
    }
  });

  return errors;
};


// Gemini OCR
ipcMain.handle('invoke-gemini-ocr', async (event, pages, documentType) => {
  const apiKey = process.env.GEMINI_API_KEY_OCR;
  if (!apiKey) {
    throw new Error('APIキーが.envファイルに設定されていません。');
  }

  const genAI = new GoogleGenAI({ apiKey: apiKey });


  const generationConfig = {
    temperature: 0.2,
    topK: 32,
    topP: 1,
    maxOutputTokens: 8192,
    responseMimeType: 'application/json',
  };

  const results = [];
  const aggregatedUsage = { promptTokens: 0, outputTokens: 0 };

  for (const page of pages) {
    // Add a defensive check to ensure the page object is not null/undefined
    if (!page) {
      log.error('An undefined page was received in invoke-gemini-ocr. Skipping.');
      console.error('An undefined page was received in invoke-gemini-ocr. Skipping.');
      continue; // Skip this iteration
    }
    try {
      log.info(`Starting OCR for file: ${page.name} with document type: ${documentType}`); // 処理開始ログを追加
      
      let prompt;
      switch (documentType) {
        case '領収書':
          prompt = 'この画像は領収書です。発行日、合計金額、支払元、支払先、但し書き、登録番号をJSON形式で抽出してください。';
          break;
        case '日計表':
        case '銀行通帳':
        case 'その他（汎用テーブル）':
          prompt = 'この画像はテーブル（表）形式のドキュメントです。1行目をヘッダー（キー）とし、2行目以降を各行のデータ（バリュー）として、JSON配列形式で構造化して抽出してください。表の中に空のセルがある場合は、その箇所を空文字列（""）として正確に表現してください。';
          break;
        case 'タイムカード':
        default:
          prompt = `画像から情報を抽出し、JSON形式で出力してください。\n\n**重要**: この画像は、元々複数のタイムカードが横に並んだ大きな画像を、個々のタイムカードの領域に分割したものである可能性があります。そのため、各画像は独立したタイムカードである可能性が高いです。\n\n**厳格なルール**: 各タイムカードは、そのカード上部に記載されている特定の人物にのみ関連付けられます。ある人物のタイムカードから読み取った時間や日付の情報を、隣接する別の人物のタイムカードの情報と**絶対に混同しないでください**。各カードの物理的な境界を**極めて明確に認識し**、それぞれのカード内のデータのみを抽出してください。氏名が読み取れた場合は、その氏名に紐づく情報のみを抽出してください。\n\n出力形式:\n- 画像が勤怠管理表やタイムカードの場合、timecard形式で出力: {"type":"timecard", "title":{"yearMonth":"YYYY年MM月", "name":"氏名"}, "days":[{"date":"D", "dayOfWeek":"ddd", "morningStart":"HH:mm", "morningEnd":"HH:mm", "afternoonStart":"HH:mm", "afternoonEnd":"HH:mm"}]}。timecardの時間は、出勤・退勤のペアがない場合nullにしてください。\n- 画像が請求書や明細書などの表形式データの場合、table形式で出力: {"type":"table", "title":{"yearMonth":"YYYY年MM月", "name":"件名や宛名"}, "headers":["ヘッダー1", "ヘッダー2", "..."], "data":[["行1セル1", "..."], ["行2セル1", "..."]]}。\n- 上記いずれにも該当しない場合は、transcription形式で出力: {"type":"transcription", "fileName":"元のファイル名", "content":"文字起こし結果"}。\n\n氏名や件名が読み取れない場合は、"不明"としてください。`;
          break;
      }
      const imagePart = {
        inlineData: {
          data: page.base64,
          mimeType: page.mimeType,
        },
      };

      // 冗長なデバッグログを削除
      // log.info('genAI object:', genAI);
      // log.info('genAI.models object:', genAI.models);
      // log.info('Before generateContent call');
      // log.info('generateContent arguments:', { model: 'gemini-flash-lite-latest', contents: [{ role: 'user', parts: [{ text: prompt }, imagePart] }], generationConfig: generationConfig });
      const result = await genAI.models.generateContent({
        model: 'gemini-flash-lite-latest',
        contents: [{ role: 'user', parts: [{ text: prompt }, imagePart] }],
        generationConfig: generationConfig,
      });
      
      if (result.usageMetadata) {
        aggregatedUsage.promptTokens += result.usageMetadata.promptTokenCount || 0;
        aggregatedUsage.outputTokens += result.usageMetadata.candidatesTokenCount || 0;
        log.info(`OCR completed for ${page.name}. Usage: Prompt Tokens=${result.usageMetadata.promptTokenCount}, Output Tokens=${result.usageMetadata.candidatesTokenCount}`); // 処理完了とトークン使用量ログを追加
      }
      
      // 冗長なデバッグログを削除
      // log.info('After generateContent call. Raw result:', result);
      // log.info('Result has response property:', result && result.response !== undefined);
      // log.info('Type of result.response:', typeof (result && result.response));
      const rawText = result.candidates[0].content.parts[0].text;
      let jsonText = rawText;

      // 1. Try to extract content from a markdown JSON block (```json ... ```)
      const jsonBlockMatch = rawText.match(/```json\s*([\s\S]*?)\s*```/);
      if (jsonBlockMatch && jsonBlockMatch[1]) {
        jsonText = jsonBlockMatch[1].trim();
      } else {
        // 2. If no markdown block, try to find the content between the first '{' and the last '}'
        const jsonObjectMatch = rawText.match(/\{[\s\S]*\}/);
        if (jsonObjectMatch) {
          jsonText = jsonObjectMatch[0];
        } else {
          // 3. Fallback: remove all markdown fences and trim
          jsonText = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
        }
      }

      const parsedData = JSON.parse(jsonText);

      const dataToProcess = Array.isArray(parsedData) ? parsedData : [parsedData];

      for (const data of dataToProcess) {
        // Add original filename to transcription type
        if (!data.type) {
          if (data.days && Array.isArray(data.days)) {
            data.type = 'timecard';
          } else if (data.headers && Array.isArray(data.headers) && data.data && Array.isArray(data.data)) {
            data.type = 'table';
          } else {
            data.type = 'transcription';
          }
        }

        if (data.type === 'transcription') {
          data.fileName = page.name;
        }

        // ★★★ Run validation and attach errors ★★★
        const validationErrors = validateData(data);
        data.errors = validationErrors;

        results.push(data);
      }

    } catch (error) {
      log.error('Gemini OCR Error:', error);
      console.error('Gemini OCR Error in main process:', error);
      const errorMessage = error.message || '';
      if (errorMessage.includes('429') && (errorMessage.includes('RESOURCE_EXHAUSTED') || errorMessage.includes('exceeded your current quota'))) {
        throw new Error('Gemini APIの無料利用枠の上限に達しました。しばらくしてから再試行するか、Google Cloudプロジェクトで課金を有効にすることを検討してください。');
      }
      throw new Error(`AI処理中にエラーが発生しました: ${errorMessage}`);
    }
  }
  return { data: results, usage: aggregatedUsage };
});

ipcMain.handle('invoke-ai-chat', async (_event, payload) => {
  const apiKey = process.env.VITE_OPENROUTER_API_KEY;
  const modelId = 'deepseek/deepseek-chat-v3.1:free'; // User requested model

  if (!apiKey) {
    const message = 'OpenRouter APIキーが.envファイルに設定されていません。(VITE_OPENROUTER_API_KEY)';
    log.error(message);
    return { success: false, error: message };
  }

  const prompt = typeof payload === 'string' ? payload : payload?.prompt;
  if (!prompt || typeof prompt !== 'string') {
    const message = 'AIチャットAPIに送信するpromptが指定されていません。';
    log.error(message);
    return { success: false, error: message };
  }

  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "http://localhost:5173", // Optional
        "X-Title": "ALCS Document OCR", // Optional
      },
      body: JSON.stringify({
        "model": modelId,
        "messages": [
          { "role": "user", "content": prompt },
        ],
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      let message = `OpenRouter API error: ${response.status} ${response.statusText}\n${errorBody}`;
      if (response.status === 404 && errorBody.includes('No endpoints found')) {
        message += `\nThe requested model (${modelId}) is not available.`;
      } else if (response.status === 429) {
        message += `\n${modelId} is currently rate-limited upstream. Please wait and try again.`;
      }
      log.error(message);
      return { success: false, error: message };
    }

    const responseData = await response.json();

    return {
      success: true,
      data: responseData,
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    log.error('OpenRouter API呼び出しに失敗しました:', error);
    return {
      success: false,
      error: 'OpenRouter API呼び出しに失敗しました: ' + errorMessage,
    };
  }
});
// --- Image Preprocessing Function (moved from preload) ---
/**
 * Processes an image using Jimp for optimization before sending to an OCR API.
 * - Resizes the image to a max width/height of 1200px.
 * - Sets a standard quality for compression.
 * @param arrayBuffer The raw image data.
 * @param options Options to control preprocessing.
 * @returns A promise that resolves to the processed image as a base64 string and its mime type.
 */
const processImageWithJimp = async (arrayBuffer, options) => {
  try {
    const image = await Jimp.read(Buffer.from(arrayBuffer));

    // EXIF-based auto-rotation
    if (image._exif && image._exif.tags && image._exif.tags.Orientation) {
      const orientation = image._exif.tags.Orientation;
      log.info(`Image EXIF Orientation found: ${orientation}`);
      switch (orientation) {
        case 2: image.mirror(true, false); break;
        case 3: image.rotate(180); break;
        case 4: image.mirror(false, true); break;
        case 5: image.rotate(90).mirror(true, false); break;
        case 6: image.rotate(90); break;
        case 7: image.rotate(270).mirror(true, false); break;
        case 8: image.rotate(270); break;
      }
    }

    const width = image.getWidth();
    const height = image.getHeight();
    const imagesToProcess = [];

    // Heuristic to detect and split multiple horizontal documents
    if (width > height * 1.8) {
      log.info(`Wide image detected (width: ${width}, height: ${height}). Splitting into 3 parts.`);
      const partWidth = Math.floor(width / 3);
      for (let i = 0; i < 3; i++) {
        imagesToProcess.push(image.clone().crop(i * partWidth, 0, partWidth, height));
      }
    } else {
      imagesToProcess.push(image);
    }

    const processedImages = [];
    for (const img of imagesToProcess) {
      if (options.isAutocropEnabled) {
        img.autocrop();
      }
      if (options.isContrastAdjustmentEnabled) {
        img.contrast(0.2);
      }
      img.scaleToFit(1200, 1200);
      img.quality(85);

      const mimeType = Jimp.MIME_JPEG;
      const base64 = await img.getBase64Async(mimeType);
      processedImages.push({ base64: base64.split(',')[1], mimeType });
    }
    
    log.info(`Image processing resulted in ${processedImages.length} image(s).`);
    return processedImages;

  } catch (error) {
    log.error("Error processing image with Jimp in main process:", error);
    throw new Error("画像の前処理中にエラーが発生しました。");
  }
};

// IPC handler for image preprocessing
ipcMain.handle('process-image-for-ocr', async (event, arrayBuffer, options) => {
  return processImageWithJimp(arrayBuffer, options);
});

// Save File
ipcMain.handle('save-file', async (event, options, data) => {
  const { canceled, filePath: selectedFilePath } = await dialog.showSaveDialog(mainWindow, options);
  if (canceled || !selectedFilePath) {
    return { success: false, canceled: true };
  }

  let finalFilePath = selectedFilePath;
  // 拡張子がない場合、または異なる拡張子の場合に.xlsxを追加
  if (!finalFilePath.toLowerCase().endsWith('.xlsx')) {
    finalFilePath += '.xlsx';
  }

  try {
    // Convert ArrayBuffer to Buffer
    const bufferData = Buffer.from(data);
    await fs.promises.writeFile(finalFilePath, bufferData); // 修正後のパスを使用
    return { success: true, path: finalFilePath };
  } catch (error) {
    log.error('File Save Error:', error);
    return { success: false, error: error.message };
  }
});

// Open Template File
ipcMain.handle('open-template-file', async () => {
  log.info('open-template-file IPC handler called');
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [{ name: 'Excelファイル', extensions: ['xlsx', 'xlsm', 'xls'] }],
  });
  if (canceled || filePaths.length === 0) {
    log.info('open-template-file result:', { success: false, canceled: true });
    return { success: false, canceled: true };
  }
  const filePath = filePaths[0];
  try {
    const data = await fs.promises.readFile(filePath);
    const result = { success: true, path: filePath, name: path.basename(filePath), data };
    log.info('open-template-file result:', { success: result.success, path: result.path, name: result.name, data_length: result.data?.length });
    return result;
  } catch (error) {
    log.error('Template Open Error:', error);
    return { success: false, error: error.message };
  }
});

// Open Roster File
ipcMain.handle('open-roster-file', async () => {
  log.info('open-roster-file IPC handler called');
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [{ name: 'Excelファイル', extensions: ['xlsx', 'xlsm', 'xls'] }],
  });
  if (canceled || filePaths.length === 0) {
    log.info('open-roster-file result:', { success: false, canceled: true });
    return { success: false, canceled: true };
  }
  const filePath = filePaths[0];
  const result = { success: true, path: filePath, name: path.basename(filePath) };
  log.info('open-roster-file result:', { success: result.success, path: result.path, name: result.name });
  return result;
});

// Open File in Shell
ipcMain.handle('open-file', async (event, filePath) => {
  try {
    await shell.openPath(filePath);
    return { success: true };
  } catch (error) {
    log.error('File Open Error:', error);
    return { success: false, error: error.message };
  }
});

// Run Python Script
ipcMain.handle('run-python-script', async (event, { args }) => {
  return new Promise((resolve) => {
    const tempDir = app.getPath('temp');
    const tempInputFileName = `${uuidv4()}.json`;
    const tempInputFilePath = path.join(tempDir, tempInputFileName);
    const tempOutputFileName = `${uuidv4()}.json`;
    const tempOutputFilePath = path.join(tempDir, tempOutputFileName);

    const scriptName = 'excel_handler';
    let scriptPath;
    if (isDev) {
      scriptPath = path.join(__dirname, `${scriptName}.py`);
    } else {
      const unpackedDir = __dirname.replace('app.asar', 'app.asar.unpacked');
      scriptPath = path.join(unpackedDir, 'dist', scriptName, `${scriptName}.exe`);
    }

    if (!fs.existsSync(scriptPath)) {
      const errorMsg = `Script not found: ${scriptPath}`;
      log.error(errorMsg);
      return resolve({ success: false, error: errorMsg });
    }

    fs.writeFile(tempInputFilePath, JSON.stringify(args), 'utf8', (err) => {
      if (err) {
        log.error('Failed to write temp input file for python script:', err);
        return resolve({ success: false, error: '一時ファイルの作成に失敗しました。' });
      }

      let command;
      let argsForSpawn;

      if (isDev) {
        command = 'python';
        argsForSpawn = [scriptPath, tempInputFilePath, tempOutputFilePath];
      } else {
        command = 'cmd.exe';
        argsForSpawn = ['/c', `chcp 65001 > nul && "${scriptPath}" "${tempInputFilePath}" "${tempOutputFilePath}"`];
      }

      log.info(`Python command: ${command}`);
      log.info(`Python arguments: ${argsForSpawn.join(' ')}`);
      const pyProcess = spawn(command, argsForSpawn, {
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: true,
        env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
      });

      let stderr = '';

      pyProcess.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      pyProcess.on('close', async (code) => {
        if (stderr) {
          log.error(`Python script stderr: ${stderr}`);
        }
        if (code !== 0) {
          log.error(`Python script exited with code ${code}`);
          return resolve({ success: false, error: `スクリプトの実行に失敗しました。詳細はログを確認してください。\n${stderr}` });
        }

        try {
          if (fs.existsSync(tempOutputFilePath)) {
            const fileContent = await fs.promises.readFile(tempOutputFilePath, 'utf8');
            const result = JSON.parse(fileContent);
            resolve(result);
          } else {
            throw new Error('Python script did not create an output file.');
          }
        } catch (e) {
          log.error('Failed to read or parse python script output file:', e);
          resolve({ success: false, error: 'スクリプトからの応答の解析に失敗しました。' });
        } finally {
            if (fs.existsSync(tempInputFilePath)) {
                fs.unlink(tempInputFilePath, (unlinkErr) => {
                    if (unlinkErr) log.error(`Failed to delete temp input file: ${unlinkErr}`);
                });
            }
            if (fs.existsSync(tempOutputFilePath)) {
                fs.unlink(tempOutputFilePath, (unlinkErr) => {
                    if (unlinkErr) log.error(`Failed to delete temp output file: ${unlinkErr}`);
                });
            }
        }
      });

      pyProcess.on('error', (spawnError) => {
        log.error(`Failed to start python script process: ${spawnError.message}`);
        resolve({ success: false, error: `Pythonプロセスの開始に失敗しました: ${spawnError.message}` });
      });
    });
  });
});

// Read Roster File
ipcMain.handle('read-roster-file', async (event, { filePath, sheetName, column, hasHeader }) => {
  return new Promise((resolve) => {
    const tempDir = app.getPath('temp');
    const tempInputFileName = `${uuidv4()}.json`;
    const tempInputFilePath = path.join(tempDir, tempInputFileName);
    const tempOutputFileName = `${uuidv4()}.json`; // New temp file for output
    const tempOutputFilePath = path.join(tempDir, tempOutputFileName); // New temp file for output

    // Determine python script path
    const scriptName = 'excel_handler';
    let scriptPath;
    if (isDev) {
      scriptPath = path.join(__dirname, `${scriptName}.py`);
    } else {
      const unpackedDir = app.getAppPath().replace('.asar', '.asar.unpacked');
      scriptPath = path.join(unpackedDir, 'dist', scriptName, `${scriptName}.exe`);
    }
    
    if (!fs.existsSync(scriptPath)) {
        const errorMsg = `スクリプトが見つかりません: ${scriptPath}`;
        log.error(errorMsg);
        return resolve({ success: false, error: errorMsg });
    }

    const args = {
      action: 'read_roster', // 新しいアクションを追加
      file_path: filePath,
      sheet_name: sheetName,
      column: column,
      has_header: hasHeader, // hasHeaderを追加
      log_dir: app.getPath('userData') + '\\logs' // 追加
    };

    fs.writeFile(tempInputFilePath, JSON.stringify(args), 'utf8', (err) => {
      if (err) {
        log.error('Failed to write temp input file for python script:', err);
        return resolve({ success: false, error: '一時ファイルの作成に失敗しました。' });
      }

      let command;
      let argsForSpawn;

      if (isDev) {
        command = 'python';
        argsForSpawn = [scriptPath, tempInputFilePath, tempOutputFilePath]; // Pass output file path
      } else {
        command = 'cmd.exe';
        argsForSpawn = ['/c', `chcp 65001 > nul && "${scriptPath}" "${tempInputFilePath}" "${tempOutputFilePath}"`]; // Pass output file path
      }
      
      const pyProcess = spawn(command, argsForSpawn, {
        stdio: ['pipe', 'pipe', 'pipe'], // stdin, stdout, stderr
        shell: true, // Enable shell execution to process 'chcp' command
        env: { ...process.env, PYTHONIOENCODING: 'utf-8' } // Keep PYTHONIOENCODING for good measure
      });

      log.info(`Python process spawned with PID: ${pyProcess.pid}`);

      let stdout = '';
      let stderr = '';

      pyProcess.stdout.on('data', (data) => {
        stdout += data.toString('utf8');
        log.info(`Python stdout (partial): ${data.toString('utf8').trim()}`);
      });

      pyProcess.stderr.on('data', (data) => {
        stderr += data.toString('utf8');
        log.error(`Python stderr (partial): ${data.toString('utf8').trim()}`);
      });

      pyProcess.on('close', async (code) => { // Made async to use await for file operations
        log.info(`Python process exited with code: ${code}`);
        if (stderr) {
          log.error(`Python script stderr (full): ${stderr}`);
        }

        // Read output from file instead of stdout
        let result = { success: false, error: 'スクリプトからの応答の解析に失敗しました。' };
        try {
          if (fs.existsSync(tempOutputFilePath)) {
            const fileContent = await fs.promises.readFile(tempOutputFilePath, 'utf8');
            result = JSON.parse(fileContent);
            log.info(`Python script output (parsed from file): ${JSON.stringify(result)}`);
          } else {
            log.error(`Python output file not found: ${tempOutputFilePath}`);
            result.error = `Pythonスクリプトが結果ファイルを生成しませんでした。`;
          }
        } catch (e) {
          log.error('Failed to parse python script output from file:', e, `\nRaw file content: ${fileContent}`);
          result.error = 'スクリプトからの応答の解析に失敗しました。' + e.message;
        } finally {
            // Clean up temp files
            if (fs.existsSync(tempInputFilePath)) {
                fs.unlink(tempInputFilePath, (unlinkErr) => {
                    if (unlinkErr) log.error(`Failed to delete temp input file: ${unlinkErr}`);
                });
            }
            if (fs.existsSync(tempOutputFilePath)) {
                fs.unlink(tempOutputFilePath, (unlinkErr) => {
                    if (unlinkErr) log.error(`Failed to delete temp output file: ${unlinkErr}`);
                });
            }
        }

        if (code !== 0) {
          log.error(`Python script exited with code ${code}. Full stdout: ${stdout}. Full stderr: ${stderr}`);
          result.success = false;
          result.error = result.error || `スクリプトの実行に失敗しました。詳細はログを確認してください。\n${stderr}`; // Use existing error or default
        }
        resolve(result);
      });

      pyProcess.on('error', (spawnError) => {
        log.error(`Failed to start python script process: ${spawnError.message}`);
        log.error(`Python spawn error details: ${JSON.stringify(spawnError)}`);
        resolve({ success: false, error: `Pythonプロセスの開始に失敗しました: ${spawnError.message}` });
      });
    });
  });
});

// main.js
const { app, BrowserWindow, Menu, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { autoUpdater } = require('electron-updater');
const log = require('electron-log');
const Jimp = require('jimp'); // Add Jimp import
const { Buffer } = require('buffer');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { spawn } = require('child_process');
const os = require('os');
const { v4: uuidv4 } = require('uuid');

// --- Prompts Configuration ---
const prompts = JSON.parse(fs.readFileSync(path.join(__dirname, 'prompts.json'), 'utf-8'));

// 画像処理用の定数
const DEFAULT_BACKGROUND_COLOR = 0xFFFFFFFF;  // 白色
const CONTRAST_ADJUSTMENT_AMOUNT = 0.2;       // コントラスト調整量 (-1 to +1)

// 画像の前処理を行う関数
const preprocessImage = async (imageBuffer, { isAutocropEnabled, isContrastAdjustmentEnabled }) => {
  try {
    const image = await Jimp.read(imageBuffer);
    if (isContrastAdjustmentEnabled) {
      image.contrast(CONTRAST_ADJUSTMENT_AMOUNT);
    }
    // Autocropping logic was here, but removed for now to simplify and ensure stability.
    const processedBuffer = await image.getBufferAsync(Jimp.MIME_JPEG);
    return {
      base64: processedBuffer.toString('base64'),
      mimeType: 'image/jpeg'
    };
  } catch (error) {
    log.error('Image preprocessing error:', error);
    throw new Error(`画像の前処理中にエラーが発生しました: ${error.message}`);
  }
};

// Initialize electron-log
log.initialize({ spyRendererConsole: true });

// --- Standalone Python Script Runner ---
async function runPythonScript(args) {
  const tempDir = app.getPath('temp');
  const inputFilePath = path.join(tempDir, `input-${uuidv4()}.json`);
  const outputFilePath = path.join(tempDir, `output-${uuidv4()}.json`);

  const pythonExecutablePath = isDev
    ? path.join(__dirname, 'dist', 'excel_handler', 'excel_handler.exe')
    : path.join(process.resourcesPath, 'dist', 'excel_handler', 'excel_handler.exe');

  try {
    fs.writeFileSync(inputFilePath, JSON.stringify({ ...args, log_dir: tempDir }));

    await new Promise((resolve, reject) => {
      const process = spawn(pythonExecutablePath, [inputFilePath, outputFilePath]);
      process.stdout.on('data', (data) => log.info(`Python stdout: ${data}`));
      process.stderr.on('data', (data) => log.error(`Python stderr: ${data}`));
      process.on('close', (code) => {
        if (code === 0) resolve();
        else reject(new Error(`Python script exited with code ${code}`));
      });
      process.on('error', (err) => reject(err));
    });

    if (fs.existsSync(outputFilePath)) {
      return JSON.parse(fs.readFileSync(outputFilePath, 'utf-8'));
    } else {
      throw new Error('Python script did not produce an output file.');
    }
  } catch (error) {
    log.error('Error running python script:', error);
    return { success: false, error: error.message };
  } finally {
    if (fs.existsSync(inputFilePath)) fs.unlinkSync(inputFilePath);
    if (fs.existsSync(outputFilePath)) fs.unlinkSync(outputFilePath);
  }
}

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
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  const devServerUrl = process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173';
  const startUrl = isDev ? devServerUrl : `file://${path.join(__dirname, 'dist', 'index.html')}`;
  
  mainWindow.loadURL(startUrl);
  if (isDev) {
    mainWindow.webContents.openDevTools();
  }
  mainWindow.on('closed', () => mainWindow = null);
}

// --- Application Menu ---
const createMenu = () => {
  const template = [ { label: 'ファイル', submenu: [ { role: 'quit', label: '終了' } ] }, { label: '表示', submenu: [ { role: 'reload', label: 'リロード' }, { role: 'forceReload', label: '強制的にリロード' }, { role: 'toggleDevTools', label: '開発者ツールを表示' }, { type: 'separator' }, { role: 'resetZoom', label: '実際のサイズ' }, { role: 'zoomIn', label: '拡大' }, { role: 'zoomOut', label: '縮小' } ] }, { label: 'ヘルプ', submenu: [ { label: 'バージョン情報', click: () => { dialog.showMessageBox(mainWindow, { type: 'info', title: 'バージョン情報', message: `ALCS文書OCR
バージョン: ${app.getVersion()}
Electron: ${process.versions.electron}
Node: ${process.versions.node}` }); } }, { label: '更新を確認', click: () => { autoUpdater.checkForUpdatesAndNotify(); if (mainWindow) { mainWindow.webContents.send('show-update-notification'); } } } ] } ];
  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
};

// IPCハンドラーを定義
const setupIpcHandlers = () => {
  ipcMain.handle('invoke-ai-chat', async (event, payload) => {
    const prompt = payload?.prompt || '';
    const apiKey = process.env.GEMINI_API_KEY_CHAT;
    if (!apiKey) return { success: false, error: 'AIアシスタント用のGemini APIキーが.envに設定されていません。(GEMINI_API_KEY_CHAT)' };
    try {
      const genAIChat = new GoogleGenerativeAI(apiKey);
      const model = genAIChat.getGenerativeModel({ model: 'gemini-flash-lite-latest' });
      const result = await model.generateContent([prompt]);
      const response = await result.response;
      return { success: true, data: { choices: [{ message: { content: response.text() } }] } };
    } catch (err) {
      log.error('Error in invoke-ai-chat handler:', err);
      return { success: false, error: err.message || String(err) };
    }
  });

  ipcMain.handle('process-image-for-ocr', async (event, arrayBuffer, options = {}) => {
    try {
      return await preprocessImage(Buffer.from(arrayBuffer), options);
    } catch (error) {
      log.error('Error in process-image-for-ocr handler:', error);
      throw new Error(`画像処理中にエラーが発生しました: ${error.message}`);
    }
  });

  ipcMain.handle('open-roster-file', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, { title: '名簿ファイルを選択', properties: ['openFile'], filters: [{ name: 'Excel Files', extensions: ['xlsx', 'xls', 'xlsm'] }] });
    if (canceled || filePaths.length === 0) return { success: false, canceled: true };
    return { success: true, path: filePaths[0], name: path.basename(filePaths[0]) };
  });

  ipcMain.handle('open-template-file', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, { title: 'Excelテンプレートファイルを選択', properties: ['openFile'], filters: [{ name: 'Excel Files', extensions: ['xlsx', 'xlsm'] }] });
    if (canceled || filePaths.length === 0) return { success: false, canceled: true };
    try {
      const data = fs.readFileSync(filePaths[0]);
      return { success: true, path: filePaths[0], name: path.basename(filePaths[0]), data: data };
    } catch (error) {
      log.error('Failed to read template file:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('save-file', async (event, options, fileData) => {
    const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, { title: 'ファイルを保存', defaultPath: options.defaultPath, filters: options.filters || [{ name: 'All Files', extensions: ['*'] }] });
    if (canceled || !filePath) return { success: false, canceled: true };
    try {
      fs.writeFileSync(filePath, Buffer.from(fileData));
      return { success: true, path: filePath };
    } catch (error) {
      log.error('Failed to save file:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('open-file', async (event, filePath) => {
    try {
      await shell.openPath(filePath);
      return { success: true };
    } catch (error) {
      log.error(`Failed to open file ${filePath}:`, error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('run-python-script', (event, { args }) => runPythonScript(args));

  ipcMain.handle('read-roster-file', (event, args) => runPythonScript({ action: 'read_roster', ...args }));

  ipcMain.handle('split-image-if-too-large', async (event, imageBuffer) => {
    const SPLIT_THRESHOLD = 4000;
    try {
      const image = await Jimp.read(Buffer.from(imageBuffer));
      if (image.getHeight() > SPLIT_THRESHOLD) {
        log.info(`Image height ${image.getHeight()}px exceeds threshold, splitting.`);
        const mid = Math.floor(image.getHeight() / 2);
        const top = image.clone().crop(0, 0, image.getWidth(), mid);
        const bottom = image.clone().crop(0, mid, image.getWidth(), image.getHeight() - mid);
        return [await top.getBufferAsync(Jimp.MIME_JPEG), await bottom.getBufferAsync(Jimp.MIME_JPEG)];
      }
      return [imageBuffer];
    } catch (error) {
      log.error('Error splitting image:', error);
      return [imageBuffer];
    }
  });

  ipcMain.handle('invoke-gemini-ocr', async (event, pages, documentType) => {
    const apiKey = process.env.GEMINI_API_KEY_OCR;
    if (!apiKey) throw new Error('OCR用のGemini APIキーが.envに設定されていません。(GEMINI_API_KEY_OCR)');
    const genAI = new GoogleGenerativeAI(apiKey);
    const generationConfig = { temperature: 0.2, topK: 32, topP: 1, maxOutputTokens: 8192, responseMimeType: 'application/json' };
    const results = [];
    const aggregatedUsage = { promptTokens: 0, outputTokens: 0 };

    for (let i = 0; i < pages.length; i++) {
      const page = pages[i];
      if (!page) continue;
      try {
        const pagePos = `page ${i + 1} of ${pages.length}`;
        log.info(`Starting OCR for file: ${page.name} with document type: ${documentType}`);
        const docType = {'領収書':'receipt','日計表':'daily balance sheet','銀行通帳':'bank passbook','その他（汎用テーブル）':'generic table','タイムカード':'timecard'}[documentType] || 'document';
        let pTemplate = prompts[documentType] || prompts.default;
        let prompt = pTemplate.replace('{pagePosition}', pagePos).replace('{friendlyDocName}', docType);
        const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });
        const result = await model.generateContent([{ inlineData: { data: page.base64, mimeType: page.mimeType } }, { text: prompt }], generationConfig);
        const response = await result.response;
        const text = response.text();
        const extractJson = (t) => {
          if (!t) return null;
          const match = t.match(/```json\s*([\s\S]*?)```/i);
          if (match && match[1]) return match[1].trim();
          const start = t.search(/[{\[]/);
          if (start === -1) return null;
          const end = Math.max(t.lastIndexOf(']'), t.lastIndexOf('}'));
          return (end > start) ? t.substring(start, end + 1) : t.substring(start);
        };
        let jsonText = extractJson(text);
        if (!jsonText) throw new Error('Gemini OCRの応答からJSONを抽出できませんでした。');
        const jsonResponse = JSON.parse(jsonText);
        if (Array.isArray(jsonResponse)) results.push(...jsonResponse); else results.push(jsonResponse);
        if (result.response.promptFeedback) aggregatedUsage.promptTokens += result.response.promptFeedback.tokenCount || 0;
        log.info(`Successfully processed page ${i + 1} of document ${page.name}`);
      } catch (e) {
        log.error(`Error processing page ${i + 1} of document ${page.name}:`, e);
        throw new Error(`Gemini OCRの応答からJSONを抽出または解析できませんでした: ${e.message}`);
      }
    }
    return { data: results, usage: aggregatedUsage };
  });
};

// --- App Lifecycle ---
app.on('ready', () => {
  createWindow();
  createMenu();
  setupIpcHandlers();
  setTimeout(() => autoUpdater.checkForUpdatesAndNotify(), 2000);
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });

app.on('activate', () => { if (mainWindow === null) createWindow(); });

// --- Auto-updater Event Handlers ---
autoUpdater.on('update-downloaded', () => {
  log.info('Update downloaded; will install on quit');
  if (mainWindow) mainWindow.webContents.send('update-status', { message: 'アップデートの準備ができました。アプリケーションを再起動してください。', ready: true });
});

ipcMain.on('restart-app', () => autoUpdater.quitAndInstall());

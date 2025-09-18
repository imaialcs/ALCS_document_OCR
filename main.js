// main.js
const { app, BrowserWindow, Menu, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { autoUpdater } = require('electron-updater');
const log = require('electron-log');
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
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  const startUrl = isDev
    ? 'http://localhost:5173'
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

autoUpdater.on('checking-for-update', () => sendUpdateStatus({ message: '更新を確認中...' }));
autoUpdater.on('update-available', (info) => sendUpdateStatus({ message: `新しいバージョン (${info.version}) が利用可能です。ダウンロードを開始します。` }));
autoUpdater.on('update-not-available', () => sendUpdateStatus({ message: 'お使いのバージョンは最新です。', transient: true }));
autoUpdater.on('error', (err) => sendUpdateStatus({ message: `更新エラー: ${err.message}` }));
autoUpdater.on('download-progress', (progressObj) => {
  sendUpdateStatus({ message: `ダウンロード中 ${Math.floor(progressObj.percent)}% (${Math.floor(progressObj.bytesPerSecond / 1024)} KB/s)` });
});
autoUpdater.on('update-downloaded', () => sendUpdateStatus({ message: 'アップデートの準備ができました。アプリケーションを再起動してください。', ready: true }));

ipcMain.on('restart-app', () => {
  autoUpdater.quitAndInstall();
});

// --- IPC Handlers ---

// Gemini OCR
ipcMain.handle('invoke-gemini-ocr', async (event, pages) => {
  const apiKey = process.env.API_KEY;
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

  for (const page of pages) {
    try {
      const prompt = `
以下の画像から情報を抽出し、JSON形式で出力してください。
画像が勤怠管理表やタイムカードの場合、以下のtimecard形式で出力してください。
- title: { yearMonth: "YYYY年MM月", name: "氏名" }
- days: [{ date: "D", dayOfWeek: "ddd", morningStart: "HH:mm", morningEnd: "HH:mm", afternoonStart: "HH:mm", afternoonEnd: "HH:mm" }]
- morning/afternoonの時間は、出勤・退勤のペアがなければnullにしてください。

画像が請求書や明細書などの表形式データの場合、以下のtable形式で出力してください。
- title: { yearMonth: "YYYY年MM月", name: "件名や宛名" }
- headers: ["ヘッダー1", "ヘッダー2", ...]
- data: [["行1セル1", "行1セル2", ...], ["行2セル1", "行2セル2", ...]]

上記いずれにも該当しない、または判断が難しい場合は、画像の内容を単純に文字起こしし、以下のtranscription形式で出力してください。
- type: "transcription"
- fileName: "元のファイル名"
- content: "文字起こし結果"

氏名や件名が読み取れない場合は、"不明"としてください。
`;
      const imagePart = {
        inlineData: {
          data: page.base64,
          mimeType: page.mimeType,
        },
      };

      log.info('genAI object:', genAI);
      log.info('genAI.models object:', genAI.models);
      log.info('Before generateContent call');
      log.info('generateContent arguments:', { model: 'gemini-2.5-flash', contents: [{ role: 'user', parts: [{ text: prompt }, imagePart] }], generationConfig: generationConfig });
      const result = await genAI.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [{ role: 'user', parts: [{ text: prompt }, imagePart] }],
        generationConfig: generationConfig,
      });
      log.info('After generateContent call. Raw result:', result);
      log.info('Result has response property:', result && result.response !== undefined);
      log.info('Type of result.response:', typeof (result && result.response));
      const jsonText = result.candidates[0].content.parts[0].text.replace(/```json/g, '').replace(/```/g, '').trim();
      const data = JSON.parse(jsonText);
      
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
      results.push(data);

    } catch (error) {
      log.error('Gemini OCR Error:', error);
      console.error('Gemini OCR Error in main process:', error);
      throw new Error(`AI処理中にエラーが発生しました: ${error.message}`);
    }
  }
  return results;
});

// Save File
ipcMain.handle('save-file', async (event, options, data) => {
  const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, options);
  if (canceled || !filePath) {
    return { success: false, canceled: true };
  }
  try {
    await fs.promises.writeFile(filePath, data);
    return { success: true, path: filePath };
  } catch (error) {
    log.error('File Save Error:', error);
    return { success: false, error: error.message };
  }
});

// Open Template File
ipcMain.handle('open-template-file', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [{ name: 'Excelファイル', extensions: ['xlsx', 'xlsm', 'xls'] }],
  });
  if (canceled || filePaths.length === 0) {
    return { success: false, canceled: true };
  }
  const filePath = filePaths[0];
  try {
    const data = await fs.promises.readFile(filePath);
    return { success: true, path: filePath, name: path.basename(filePath), data };
  } catch (error) {
    log.error('Template Open Error:', error);
    return { success: false, error: error.message };
  }
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
  return new Promise((resolve, reject) => {
    const tempDir = app.getPath('temp');
    const tempFileName = `${uuidv4()}.json`;
    const tempFilePath = path.join(tempDir, tempFileName);

    // Determine python script path
    const scriptName = 'excel_handler';
    let scriptPath;
    if (isDev) {
      // In development, run the .py script directly
      scriptPath = path.join(__dirname, `${scriptName}.py`);
    } else {
      // In production, run the executable
      const unpackedDir = app.getAppPath().replace('.asar', '.asar.unpacked');
      scriptPath = path.join(unpackedDir, 'dist', scriptName, `${scriptName}.exe`);
    }
    
    if (!fs.existsSync(scriptPath)) {
        const errorMsg = `スクリプトが見つかりません: ${scriptPath}`;
        log.error(errorMsg);
        return resolve({ success: false, error: errorMsg });
    }

    fs.writeFile(tempFilePath, JSON.stringify(args), 'utf8', (err) => {
      if (err) {
        log.error('Failed to write temp file for python script:', err);
        return resolve({ success: false, error: '一時ファイルの作成に失敗しました。' });
      }

      log.info(`Determined scriptPath: ${scriptPath}`);
      let command;
      let argsForSpawn;

      if (isDev) {
        command = 'python';
        argsForSpawn = [scriptPath, tempFilePath];
      } else {
        command = scriptPath; // scriptPath is the path to the .exe
        argsForSpawn = [tempFilePath];
      }
      
      log.info(`Python command: ${command}`);
      log.info(`Python arguments: ${argsForSpawn.join(' ')}`);
      log.info(`Is development mode: ${isDev}`);

      const pyProcess = spawn(command, argsForSpawn);

      let stdout = '';
      let stderr = '';

      pyProcess.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      pyProcess.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      pyProcess.on('close', (code) => {
        if (stderr) {
          log.error(`Python script stderr: ${stderr}`);
        }
        if (code !== 0) {
          log.error(`Python script exited with code ${code}`);
          return resolve({ success: false, error: `スクリプトの実行に失敗しました。詳細はログを確認してください。
${stderr}` });
        }
        try {
          const result = JSON.parse(stdout);
          resolve(result);
        } catch (e) {
          log.error('Failed to parse python script output:', e, `
Raw output: ${stdout}`);
          resolve({ success: false, error: 'スクリプトからの応答の解析に失敗しました。' });
        }
      });

      pyProcess.on('error', (spawnError) => {
        log.error('Failed to start python script:', spawnError);
        resolve({ success: false, error: `Pythonプロセスの開始に失敗しました: ${spawnError.message}` });
      });
    });
  });
});

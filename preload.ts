// preload.js
const { contextBridge, ipcRenderer } = require('electron');

// レンダラープロセス（UI側）の `window` オブジェクトに、安全なAPIを公開します。
contextBridge.exposeInMainWorld('electronAPI', {
  // --- Secure Gemini OCR Invocation ---
  invokeGeminiOcr: (pages: any[]) => ipcRenderer.invoke('invoke-gemini-ocr', pages),

  // --- File Save API ---
  saveFile: (options: Electron.SaveDialogOptions, data: Uint8Array) => ipcRenderer.invoke('save-file', options, data),

  // --- Excel Write API ---
  writeToExcel: (params: any) => ipcRenderer.invoke('write-excel', params),

  // --- Python Script Execution API ---
  runPythonScript: (options: { args: any }) => ipcRenderer.invoke('run-python-script', options),

  // --- Template File Open API ---
  openTemplateFile: () => ipcRenderer.invoke('open-template-file'),
  openRosterFile: () => ipcRenderer.invoke('open-roster-file'),

  // --- File Open API ---
  openFile: (filePath: string) => ipcRenderer.invoke('open-file', filePath),

  // --- Auto-update API ---
  readRosterFile: (options: { filePath: string; sheetName: string; column: string; hasHeader?: boolean; }) => ipcRenderer.invoke('read-roster-file', options),
  onUpdateStatus: (callback: (status: { message: string; ready?: boolean; transient?: boolean }) => void) => {
    // We wrap the callback to ensure we are only passing the expected arguments.
    const listener = (_event: Electron.IpcRendererEvent, status: { message: string; ready?: boolean; transient?: boolean }) => callback(status);
    ipcRenderer.on('update-status', listener);
    // Return a cleanup function to be used in React's useEffect.
    return () => ipcRenderer.removeListener('update-status', listener);
  },
  onShowUpdateNotification: (callback: () => void) => {
    const listener = (_event: Electron.IpcRendererEvent) => callback();
    ipcRenderer.on('show-update-notification', listener);
    return () => ipcRenderer.removeListener('show-show-update-notification', listener);
  },
  restartApp: () => ipcRenderer.send('restart-app'),

  // --- Context Menu API ---
  showContextMenu: () => ipcRenderer.send('show-context-menu'),

  setMenu: (template: any[]) => ipcRenderer.invoke('set-menu', template)
});

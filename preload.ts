const { contextBridge, ipcRenderer } = require('electron');

try {
  contextBridge.exposeInMainWorld('electronAPI', {
    invokeAiChat: (payload: { prompt: string }) => ipcRenderer.invoke('invoke-ai-chat', payload),

    // --- Secure Gemini OCR Invocation ---
    invokeGeminiOcr: (pages: { base64: string; mimeType: string; name: string }[]) => ipcRenderer.invoke('invoke-gemini-ocr', pages),

      // --- Image Preprocessing API ---
      processImageForOcr: (arrayBuffer: ArrayBuffer, options: { isAutocropEnabled: boolean, isContrastAdjustmentEnabled: boolean }) => ipcRenderer.invoke('process-image-for-ocr', arrayBuffer, options),
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

  // --- Temporary File Management API ---
  cacheTempFile: (fileName: string, data: ArrayBuffer) => ipcRenderer.invoke('cache-temp-file', fileName, data),
  deleteTempFile: (filePath: string) => ipcRenderer.invoke('delete-temp-file', filePath),

  setMenu: (template: any[]) => ipcRenderer.invoke('set-menu', template)
  });
} catch (error) {
  console.error("Error exposing electronAPI in preload:", error);
}

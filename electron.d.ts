// This file provides type definitions for the Electron APIs exposed via preload.js.
// It is used for TypeScript type checking in the renderer process.

// By defining the Window interface directly, we augment the global scope.
// This file is treated as a global script because it lacks top-level imports/exports.
interface Window {
  electronAPI: {
    /**
     * Invokes the Gemini OCR process in the main process.
     * @param pages An array of page data to be processed.
     * @returns A promise that resolves with the processed data.
     */
    invokeGeminiOcr: (pages: { base64: string; mimeType: string, name: string }[]) => Promise<import('./types').ProcessedData[]>;

    /**
     * Listens for update status messages from the main process.
     * @param callback The function to execute when a message is received.
     * The callback receives a status object with a message and an optional 'ready' flag.
     * @returns A function to remove the listener.
     */
    onUpdateStatus: (
      callback: (status: { message: string; ready?: boolean; transient?: boolean }) => void
    ) => () => void;
    /**
     * Tells the main process to quit the application and install the update.
     */
    restartApp: () => void;

    /**
     * Opens a save dialog and writes the provided data to the selected file.
     * @param options The options for the save dialog, including the default file path.
     * @param data The file content as a Uint8Array.
     * @returns A promise that resolves with the result of the save operation.
     */
    saveFile: (options: { defaultPath: string }, data: Uint8Array) => Promise<{ success: boolean; canceled?: boolean; path?: string }>;

    /**
     * Opens a file in the default application.
     * @param filePath The path to the file to open.
     * @returns A promise that resolves when the open command is issued.
     */
    openFile: (filePath: string) => Promise<void>;
    
    /**
     * Writes data to an Excel template file.
     * @param params The parameters for the write operation.
     * @returns A promise that resolves with the result of the operation.
     */
    writeToExcel: (params: { 
      templatePath: string; 
      operations: { 
        sheetName: string; 
        data: (string | null)[][]; 
        startRow: number; 
        startCol: number; 
      }[]; 
    }) => Promise<{ success: boolean; path?: string; error?: string }>;

    /**
     * Opens a dialog to select a template file.
     * @returns A promise that resolves with the file details.
     */
    openTemplateFile: () => Promise<{ 
      success: boolean; 
      canceled?: boolean; 
      path?: string; 
      data?: Buffer; 
      name?: string; 
      error?: string; 
    }>;
  };
}
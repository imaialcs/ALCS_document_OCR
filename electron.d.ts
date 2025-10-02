
// electron.d.ts
import { ProcessedData } from './types';

declare global {
  interface Window {
    electronAPI: {
      invokeGeminiOcr: (pages: { base64: string; mimeType: string; name: string }[], documentType: string) => Promise<{ data: ProcessedData[], usage: { promptTokens: number, outputTokens: number } }>;
      invokeGrok: (payload: { prompt: string }) => Promise<{ success: boolean; data?: { choices: { message: { content: string } }[] }; error?: string }>;
      invokeGrokApi: (payload: { prompt: string }) => Promise<{ success: boolean; data?: { choices: { message: { content: string } }[] }; error?: string }>;

      processImageForOcr: (arrayBuffer: ArrayBuffer, options: { isAutocropEnabled: boolean, isContrastAdjustmentEnabled: boolean }) => Promise<{ base64: string; mimeType: string }>;
      saveFile: (options: any, data: Uint8Array) => Promise<{ success: boolean; path?: string; error?: string; canceled?: boolean; }>;
      runPythonScript: (options: any) => Promise<{ success: boolean; message?: string; error?: string; }>;
      openTemplateFile: () => Promise<{ success: boolean; path?: string; name?: string; data?: any; error?: string; canceled?: boolean; }>;
      openRosterFile: () => Promise<{ success: boolean; path?: string; name?: string; canceled?: boolean; }>;
      openFile: (filePath: string) => Promise<{ success: boolean; error?: string; }>;
      readRosterFile: (options: { filePath: string; sheetName: string; column: string; hasHeader?: boolean; }) => Promise<{ success: boolean; names?: string[]; error?: string; }>;
      onUpdateStatus: (callback: (status: { message: string; ready?: boolean; transient?: boolean }) => void) => () => void;
      onShowUpdateNotification: (callback: () => void) => () => void;
      restartApp: () => void;
      showContextMenu: () => void;
    };
  }
}

// Add this export to make it a module, which avoids polluting the global namespace too much
// and allows for imports within this file.
export {};

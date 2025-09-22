
// electron.d.ts
import { ProcessedData } from './types';

declare global {
  interface Window {
    electronAPI: {
      invokeGeminiOcr: (pages: { base64: string; mimeType: string; name: string }[]) => Promise<ProcessedData[]>;
      saveFile: (options: any, data: Uint8Array) => Promise<{ success: boolean; path?: string; error?: string; canceled?: boolean; }>;
      runPythonScript: (options: any) => Promise<{ success: boolean; message?: string; error?: string; }>;
      openTemplateFile: () => Promise<{ success: boolean; path?: string; name?: string; data?: any; error?: string; canceled?: boolean; }>;
      openFile: (filePath: string) => Promise<{ success: boolean; error?: string; }>;
      onUpdateStatus: (callback: (status: { message: string; ready?: boolean; transient?: boolean }) => void) => () => void;
      restartApp: () => void;
      showContextMenu: () => void;
    };
  }
}

// Add this export to make it a module, which avoids polluting the global namespace too much
// and allows for imports within this file.
export {};

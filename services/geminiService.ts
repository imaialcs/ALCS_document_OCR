import { ProcessedData } from '../types';

export const processDocumentPages = async (
  pages: { base64: string; mimeType: string, name: string }[]
): Promise<ProcessedData[]> => {
  if (window.electronAPI?.invokeGeminiOcr) {
    return window.electronAPI.invokeGeminiOcr(pages);
  }
  throw new Error("OCR処理機能が利用できません。アプリケーションを再起動してください。");
};

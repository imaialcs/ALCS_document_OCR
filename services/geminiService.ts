import { ProcessedData } from '../types';

// Define the new response type which includes token usage
type OcrResponse = {
  data: ProcessedData[];
  usage: {
    promptTokens: number;
    outputTokens: number;
  };
};

export const processDocumentPages = async (
  pages: { base64: string; mimeType: string, name: string }[]
): Promise<OcrResponse> => {
  if (window.electronAPI?.invokeGeminiOcr) {
    // The return type of invokeGeminiOcr should now match OcrResponse thanks to the updated d.ts file
    return window.electronAPI.invokeGeminiOcr(pages);
  }
  throw new Error("OCR処理機能が利用できません。アプリケーションを再起動してください。");
};

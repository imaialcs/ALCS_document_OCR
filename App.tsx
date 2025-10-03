import React, { useState, useCallback, useEffect, useRef, lazy, Suspense } from 'react';
import { processDocumentPages } from './services/geminiService';
import { ProcessedData, ProcessedTable, ProcessedText, FilePreview, ProcessedTimecard, TimecardDay, SuggestedOperation, ChatMessage } from './types';
import { withRetry, transformTimecardJsonForExcelHandler, readFileAsArrayBuffer } from './services/utils';
import { UploadIcon, DownloadIcon, ProcessingIcon, FileIcon, CloseIcon, MailIcon, SparklesIcon, ChevronDownIcon, DocumentTextIcon, ArrowUpIcon, ArrowDownIcon, RotateLeftIcon, RotateRightIcon } from './components/icons';

import DataTable from './components/DataTable';
const UpdateNotification = lazy(() => import('./components/UpdateNotification'));
import * as XLSX from 'xlsx';
import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';
import owlIcon from '/owl.png';

import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { AiAssistant } from './components/AiAssistant';


const getBasename = (filePath: string): string => {
  if (!filePath) return '';
  // Windows (\\) と Unix (/) の両方のパス区切り文字に対応
  const lastSlash = filePath.lastIndexOf('/');
  const lastBackslash = filePath.lastIndexOf('\\');
  const lastSeparator = Math.max(lastSlash, lastBackslash);
  return filePath.substring(lastSeparator + 1);
};

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

const readFileAsBase64 = (file: File): Promise<{ base64: string; mimeType: string }> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1];
      resolve({ base64, mimeType: file.type });
    };
    reader.onerror = (error) => reject(error);
    reader.readAsDataURL(file);
  });
};

const MultiFileUploader: React.FC<{ 
  onFilesUpload: (files: FileList) => void;
  previews: FilePreview[];
  onRemoveFile: (index: number) => void;
  onClearAll: () => void;
  onPreviewClick: (preview: FilePreview) => void;
}> = ({ onFilesUpload, previews, onRemoveFile, onClearAll, onPreviewClick }) => {
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files.length > 0) {
      onFilesUpload(event.target.files);
      event.target.value = '';
    }
  };

  const handleDragOver = (event: React.DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
  };

  const handleDrop = (event: React.DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    if (event.dataTransfer.files && event.dataTransfer.files.length > 0) {
      onFilesUpload(event.dataTransfer.files);
    }
  };

  return (
    <div className="w-full">
      <label
        htmlFor="file-upload"
        className="relative flex flex-col justify-center items-center w-full min-h-[16rem] p-4 transition bg-white border-2 border-gray-300 border-dashed rounded-lg appearance-none cursor-pointer hover:border-blue-400 focus:outline-none"
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        {previews.length === 0 ? (
          <div className="flex flex-col items-center justify-center space-y-3 text-center pointer-events-none">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-slate-100">
              <UploadIcon className="h-10 w-10 text-slate-500" />
            </div>
            <p className="font-semibold text-gray-700">
              ファイルをここにドラッグ＆ドロップ
            </p>
            <p className="text-sm text-gray-500">
              または <span className="text-blue-600 font-medium">クリックしてファイルを選択</span>
            </p>
            <p className="text-xs text-gray-500 pt-2">
              (複数ファイルの画像またはPDFに対応)
            </p>
          </div>
        ) : (
          <div className="w-full h-full">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {previews.map((p, index) => (
                <div key={index} className="relative aspect-square border rounded-md overflow-hidden bg-gray-100 group">
                   <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onRemoveFile(index);
                    }}
                    className="absolute top-1 left-1 z-10 p-0.5 bg-red-600 text-white rounded-full hover:bg-red-700 opacity-0 group-hover:opacity-100 transition-opacity"
                    aria-label={`Remove ${p.name}`}
                  >
                    <CloseIcon className="w-4 h-4" />
                  </button>
                  {p.isLoading ? (
                    <div className="flex flex-col items-center justify-center h-full p-2">
                        <ProcessingIcon className="w-8 h-8 mx-auto text-gray-500 animate-spin" />
                        <p className="mt-1 text-xs font-medium text-gray-700">生成中...</p>
                    </div>
                  ) : p.url ? (
                    <img
                      src={p.url}
                      alt={p.name}
                      className={`w-full h-full object-contain ${p.type === 'image' ? 'cursor-pointer' : ''}`}
                      onClick={(e) => {
                        if (p.type === 'image') {
                            e.preventDefault();
                            e.stopPropagation();
                            onPreviewClick(p);
                        }
                      }}
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full p-2">
                        <FileIcon className="w-8 h-8 mx-auto text-gray-500" />
                        <p className="mt-1 text-xs font-medium text-gray-700 break-all text-center">{p.name}</p>
                    </div>
                  ) }
                </div>
              ))}
            </div>
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onClearAll();
              }}
              className="absolute top-2 right-2 px-3 py-1 text-xs font-medium text-white bg-red-600 rounded-md hover:bg-red-700"
            >
              すべてクリア
            </button>
          </div>
        )}
        <input id="file-upload" name="file-upload" type="file" multiple className="hidden" accept="image/*,application/pdf" onChange={handleFileChange} />
      </label>
    </div>
  );
};

const TranscriptionView: React.FC<{ 
  cardIndex: number;
  content: string;
  onContentChange: (cardIndex: number, value: string) => void;
}> = ({ cardIndex, content, onContentChange }) => {
  return (
    <textarea
      value={content}
      onChange={(e) => onContentChange(cardIndex, e.target.value)}
      className="w-full h-60 p-2 border border-gray-300 rounded-md focus:outline-none focus:border-blue-500 bg-gray-50 font-mono text-sm"
      aria-label="Transcription Content"
    />
  );
};


// --- String Similarity Function (Levenshtein Distance) ---
const levenshteinDistance = (a: string, b: string): number => {
    if (a.length === 0) return b.length;
    if (b.length === 0) return a.length;
    const matrix = [];
    for (let i = 0; i <= b.length; i++) {
        matrix[i] = [i];
    }
    for (let j = 0; j <= a.length; j++) {
        matrix[0][j] = j;
    }
    for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
            if (b.charAt(i - 1) === a.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1,
                    matrix[i][j - 1] + 1,
                    matrix[i - 1][j] + 1
                );
            }
        }
    }
    return matrix[b.length][a.length];
};

const findBestMatch = (name: string, roster: string[]): string | null => {
    if (!roster || roster.length === 0 || !name) return null;

    let bestMatch: string | null = null;
    let minDistance = Infinity;

    const normalizedName = name.replace(/\s+/g, '');
    if (!normalizedName) {
        return null;
    }

    for (const rosterName of roster) {
        const normalizedRosterName = rosterName.replace(/\s+/g, '');
        if (!normalizedRosterName) continue;

        const distance = levenshteinDistance(normalizedName, normalizedRosterName);
        
        if (distance < minDistance) {
            minDistance = distance;
            bestMatch = rosterName;
        }
    }

    // 閾値を撤廃し、最も類似度の高い候補を常に返す。
    // ただし、あまりにもかけ離れている場合（距離が名前の長さの半分を超えるなど）はnullを返す、という選択肢もあるが、
    // 今回はユーザーの要望に基づき、常に最も近いものを返す。
    return bestMatch;
};

const columnToIndex = (col: string): number => {
    let index = 0;
    const upperCol = col.toUpperCase();
    for (let i = 0; i < upperCol.length; i++) {
        index = index * 26 + upperCol.charCodeAt(i) - 'A'.charCodeAt(0) + 1;
    }
    return index - 1;
};

const findMatchingSheetName = (fullName: string, sheetNames: string[]): string | null => {
    if (!fullName || sheetNames.length === 0) {
        return null;
    }

    const trimmedFullName = fullName.trim();
    const nameParts = trimmedFullName.split(/[\u3000 ]+/).filter(p => p);

    if (nameParts.length === 0) {
        return null;
    }

    const familyName = nameParts[0]; // 名字と仮定

    const normalizedSheetNames = sheetNames.map(s => s.trim());

    // 名字と完全に一致するシートを検索
    let foundIndex = normalizedSheetNames.findIndex(sheet => sheet === familyName);
    if (foundIndex > -1) {
        return sheetNames[foundIndex];
    }
    
    return null; // 名字のみで一致するシートが見つからなかった場合、nullを返す
};

const extractJson = (text: string): any | null => {
  if (!text) return null;
  try {
    const fenced = text.match(/```json\s*([\s\S]*?)```/i);
    if (fenced?.[1]) {
      return JSON.parse(fenced[1]);
    }
    const firstObject = text.match(/\{[\s\S]*\}/);
    if (firstObject?.[0]) {
      return JSON.parse(firstObject[0]);
    }
  } catch (error) {
    console.warn('Failed to parse JSON from text:', error);
  }
  return null;
};

const App = () => {
  const [previews, setPreviews] = useState<FilePreview[]>([]);
  const [processedData, setProcessedData] = useState<ProcessedData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cancelProcessingRef = useRef(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [modalPreview, setModalPreview] = useState<FilePreview | null>(null);
  const [hasScrolledToResults, setHasScrolledToResults] = useState(false);
  const resultsRef = useRef<HTMLDivElement>(null);
  const [tokenUsage, setTokenUsage] = useState<{ promptTokens: number, outputTokens: number } | null>(null);
  
  const [updateStatus, setUpdateStatus] = useState<{ message: string; ready?: boolean; transient?: boolean } | null>(null);
  const updateTimeoutRef = useRef<number | null>(null);

  const [documentType, setDocumentType] = useState('タイムカード');
  const [roster, setRoster] = useState<string[]>([]);
  const [rosterFile, setRosterFile] = useState<{ name: string; path: string } | null>(null);
  const [rosterSettings, setRosterSettings] = useState({ sheetName: '', column: 'A' });
  const [preprocessingOptions, setPreprocessingOptions] = useState({ isAutocropEnabled: true, isContrastAdjustmentEnabled: true });
  const [excelTemplateFile, setExcelTemplateFile] = useState<{ name: string, path: string } | null>(null);
  const [excelTemplateData, setExcelTemplateData] = useState<ArrayBuffer | null>(null);
  const [outputMode, setOutputMode] = useState<'new' | 'template'>('new');
  const [templateSettings, setTemplateSettings] = useState({ dataStartCell: 'A1' });

  // --- AI関連のState ---
  const [aiMessages, setAiMessages] = useState<ChatMessage[]>([]);
  const [aiUserInput, setAiUserInput] = useState('');
  const [suggestedOperations, setSuggestedOperations] = useState<SuggestedOperation[]>([]);
  const [isSuggestionLoading, setIsSuggestionLoading] = useState(false);
  const [isAiManualLoading, setIsAiManualLoading] = useState(false);

  useEffect(() => {
    return () => {
      previews.forEach(p => {
        if (p.url && p.type === 'image' && p.url.startsWith('blob:')) {
          URL.revokeObjectURL(p.url);
        }
      });
    };
  }, []);

  useEffect(() => {
    if (processedData.length > 0 && !loading && !hasScrolledToResults) {
      resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setHasScrolledToResults(true);
    }
  }, [processedData, loading, hasScrolledToResults]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setModalPreview(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  useEffect(() => {
    let removeUpdateStatusListener: (() => void) | undefined;
    let removeShowUpdateNotificationListener: (() => void) | undefined;

    if (window.electronAPI?.onUpdateStatus) {
      removeUpdateStatusListener = window.electronAPI.onUpdateStatus((status) => {
        console.log('Update status received:', status);
        if (status.message === 'お使いのバージョンは最新です。') {
          return;
        }
        if (status.ready) {
          if (updateTimeoutRef.current) {
            clearTimeout(updateTimeoutRef.current);
          }
          setUpdateStatus(status);
        } else {
          setUpdateStatus(null);
        }
      });
    }

    if (window.electronAPI?.onShowUpdateNotification) {
      removeShowUpdateNotificationListener = window.electronAPI.onShowUpdateNotification(() => {
        setUpdateStatus({ message: '更新を確認中...', transient: true });
        if (updateTimeoutRef.current) {
          clearTimeout(updateTimeoutRef.current);
        }
        updateTimeoutRef.current = window.setTimeout(() => {
          setUpdateStatus(null);
          updateTimeoutRef.current = null;
        }, 5000);
      });
    }

    return () => {
      if (removeUpdateStatusListener) {
        removeUpdateStatusListener();
      }
      if (removeShowUpdateNotificationListener) {
        removeShowUpdateNotificationListener();
      }
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const handler = setTimeout(() => {
      const readRoster = async () => {
        if (rosterFile && rosterFile.path && rosterSettings.sheetName && rosterSettings.column) {
          try {
            const readResult = await window.electronAPI.readRosterFile({
              filePath: rosterFile.path,
              sheetName: rosterSettings.sheetName.trim(),
              column: rosterSettings.column,
              hasHeader: true,
            });

            if (readResult.success && readResult.names) {
              setRoster(readResult.names);
              setError(null);
            } else {
              if (readResult.error && !readResult.error.includes('Sheet')) {
                setError(readResult.error || '名簿ファイルの読み込みに失敗しました。');
              }
              setRoster([]);
            }
          } catch (err: any) {
            setError(`名簿ファイルの読み込み中にエラーが発生しました: ${err.message}`);
            console.error(err);
            setRoster([]);
          }
        } else if (!rosterFile) {
          setRoster([]);
        }
      };

      readRoster();
    }, 500);

    return () => {
      clearTimeout(handler);
    };
  }, [rosterFile, rosterSettings]);


  const generatePdfThumbnail = async (file: File): Promise<string> => {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const page = await pdf.getPage(1);
    
    const desiredWidth = 200;
    const viewport = page.getViewport({ scale: 1 });
    const scale = desiredWidth / viewport.width;
    const scaledViewport = page.getViewport({ scale });
    
    const canvas = document.createElement('canvas');
    canvas.height = scaledViewport.height;
    canvas.width = scaledViewport.width;
    const context = canvas.getContext('2d');

    if (!context) {
        throw new Error('Could not get canvas context');
    }
    await page.render({ canvasContext: context, viewport: scaledViewport }).promise;
    return canvas.toDataURL('image/jpeg', 0.85);
  };

  const handleFilesUpload = useCallback(async (files: FileList) => {
    const newFiles = Array.from(files);
    const newPreviews: FilePreview[] = newFiles.map(file => {
      const type = file.type.startsWith('image/') ? 'image' : 'pdf';
      return { file, type, url: type === 'image' ? URL.createObjectURL(file) : null, name: file.name, isLoading: type === 'pdf' };
    });
    setPreviews(prev => [...prev, ...newPreviews]);

    newPreviews.forEach(async (p) => {
        if (p.type === 'pdf') {
            try {
                const thumbnailUrl = await generatePdfThumbnail(p.file);
                setPreviews(current => current.map(item => item.file === p.file ? { ...item, url: thumbnailUrl, isLoading: false } : item));
            } catch (err) {
                console.error("Failed to generate PDF thumbnail for", p.name, err);
                setPreviews(current => current.map(item => item.file === p.file ? { ...item, isLoading: false } : item));
            }
        }
    });
  }, []);

  const handleRemoveFile = useCallback((indexToRemove: number) => {
    setPreviews(prev => {
      const fileToRemove = prev[indexToRemove];
      if (fileToRemove?.url && fileToRemove.type === 'image' && fileToRemove.url.startsWith('blob:')) {
        URL.revokeObjectURL(fileToRemove.url);
      }
      return prev.filter((_, index) => index !== indexToRemove);
    });
  }, []);

  const handleClearAll = useCallback(() => {
    previews.forEach(p => {
        if (p.url && p.type === 'image' && p.url.startsWith('blob:')) {
            URL.revokeObjectURL(p.url);
        }
    });
    setPreviews([]);
    setProcessedData([]);
    setError(null);
    setHasScrolledToResults(false);
  }, [previews]);

  const handlePreviewClick = useCallback((preview: FilePreview) => {
    if (preview.type === 'image' && preview.url) {
        setModalPreview(preview);
    }
  }, []);

  const handleRosterSettingsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setRosterSettings(prev => ({ ...prev, [name]: value }));
  };

  const handlePreprocessingOptionsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = e.target;
    setPreprocessingOptions(prev => ({ ...prev, [name]: checked }));
  };

  const handleRosterUpload = async () => {
    console.log('handleRosterUpload called');
    if (!window.electronAPI) return;

    const openResult = await window.electronAPI.openRosterFile();
    console.log('openRosterFile result:', openResult);
    if (!openResult.success || !openResult.path) {
      if (!openResult.canceled) {
        setError('名簿ファイルの選択がキャンセルされました。');
      }
      return;
    }
    setRosterFile({ name: openResult.name || '', path: openResult.path });
  };


  const handleTemplateSelect = async () => {
    console.log('handleTemplateSelect called');
    if (!window.electronAPI) return;
    const result = await window.electronAPI.openTemplateFile();
    console.log('openTemplateFile result:', result);
    if (result.success) {
      if (result.path && result.data && result.name) {
        try {
          setExcelTemplateFile({ name: result.name, path: result.path });
          
          const uint8Array = new Uint8Array(result.data);
          
          const arrayBuffer = uint8Array.slice().buffer;

          setExcelTemplateData(arrayBuffer);
          setError(null);
        } catch (e) {
          console.error("Failed to process template file data:", e);
          const errorMessage = e instanceof Error ? e.message : String(e);
          setError(`テンプレートファイルのデータ処理に失敗しました: ${errorMessage}`);
        }
      } else {
        setError('テンプレートファイルの読み込みに失敗しました: 必要なデータが不足しています。');
      }
    } else if (result.error) {
      setError(`テンプレートファイルの読み込みに失敗しました: ${result.error}`);
    }
  };

  const handleTemplateSettingsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const { name, value } = e.target;
      setTemplateSettings(prev => ({ ...prev, [name]: value.trim() }));
  };

  const fetchAiSuggestions = async (data: ProcessedData[]) => {
    const activeSpreadsheet = data.find(d => d.type === 'table' || d.type === 'timecard');
    if (!activeSpreadsheet) {
      setSuggestedOperations([]);
      return;
    }

    setIsSuggestionLoading(true);
    setSuggestedOperations([]);

    const prompt = `
あなたは、日本の会計基準および関連法規に精通した、経験豊富な日本の公認会計士（Japanese CPA）です。あなたの任務は、OCRによって日本のドキュメントから抽出された未加工のスプレッドシートデータを分析し、日本の会計実務に沿った、付加価値の高い操作を提案することです。

思考プロセスは、日本の会計専門家がたどるべき論理的なステップに基づいています。

現在のスプレッドシートデータ（JSON形式）:
${JSON.stringify(activeSpreadsheet, null, 2)}

---
指示:
1.  **データの理解とコンテキスト特定:**
    *   まず、このデータがどのような日本の商取引ドキュメント（請求書、領収書、納品書、銀行取引明細書など）から来たものかを特定します。
    *   データの構造、ヘッダー、内容（特に日本の元号や和暦が使われている可能性）を分析し、その会計上の意味を理解してください。

2.  **会計ワークフローの提案:**
    *   特定したドキュメントの種類に基づいて、日本の会計実務に沿った標準的な処理ワークフローを頭の中で描いてください。（例：請求書であれば、内容の検証 → 勘定科目「買掛金」として計上 → 消費税の区分経理の確認 → 支払処理の準備）
    *   このワークフローの中で、どのステップが現在のデータに適用可能かを判断します。

3.  **具体的な操作の考案とJSON出力:**
    *   判断した会計ステップを、下記の「利用可能な操作タイプ」を組み合わせた具体的な操作に変換します。最大3つまで提案してください。
    *   **建設的な操作（仕訳、分類、計算など）を、破壊的な操作（削除など）よりも優先してください。** 削除は、明らかに無関係なデータ（例：誤ってOCRされたヘッダーやフッターのテキスト）に対してのみ提案してください。
    *   提案は、"operations"というキーを持つJSONオブジェクトとして返してください。このキーの値は、提案する操作オブジェクトの配列です。
    *   各操作オブジェクトには、"name"（ボタンに表示する日本語のラベル）、"operation"（下記リストからの操作名）、"params"（操作に必要なパラメータ）の3つのキーが必要です。
    *   JSON以外のテキスト、説明、マークダウンは一切含めないでください。

JSON出力形式の例:
\`\`\`json
{
  "operations": [
    {
      "name": "「勘定科目」列を追加",
      "operation": "add_column_with_data",
      "params": { "header": "勘定科目", "data": ["消耗品費", "会議費", "消耗品費"] }
    },
    {
      "name": "合計行を計算",
      "operation": "calculate_totals",
      "params": { "columns": ["金額"] }
    }
  ]
}
\`\`\`

利用可能な操作タイプ ("operation"):
- add_column_with_data: 新しい列を追加し、データを入力します。params: { "header": "列名", "data": ["セル1", "セル2", ...] }
- create_journal_entry: 仕訳に必要な列（借方勘定科目, 借方金額, 貸方勘定科目, 貸方金額, 摘要）を追加します。この操作は通常、データ入力は伴いません。
- calculate_totals: 指定された数値列の合計を計算し、新しい行として追加します。params: { "columns": ["列名1", "列名2"] }
- delete_rows: 指定されたインデックスの行を削除します。params: { "row_indices": [0, 2, 3] } または、すべての行を削除する場合は { "all": true }。
- delete_empty_rows: 空の行をすべて削除します。
`;

    try {
      const result = await window.electronAPI.invokeAiChat({ prompt });
      if (result.success && result.data.choices && result.data.choices[0]) {
        const responseText = result.data.choices[0].message.content;
        const parsed = extractJson(responseText);
        if (parsed && parsed.operations && Array.isArray(parsed.operations)) {
          setSuggestedOperations(parsed.operations);
        } else {
          console.warn("AI response was parsed, but did not contain a valid 'operations' array.", parsed);
          setSuggestedOperations([]);
        }
      } else {
        console.warn("AI API call was not successful or returned no choices.", result);
        setSuggestedOperations([]);
      }
    } catch (e) {
      console.error("Failed to fetch or parse AI suggestions:", e);
      setSuggestedOperations([]);
    } finally {
      setIsSuggestionLoading(false);
    }
  };

  const handleProcess = async () => {
    if (previews.length === 0) return;
    console.log('[handleProcess] Starting processing...');
    setLoading(true);
    setError(null);
    setProcessedData([]);
    setSuggestedOperations([]);
    setTokenUsage(null);
    setHasScrolledToResults(false);
    cancelProcessingRef.current = false;
    setIsCancelling(false);
    
    let allExtractedData: ProcessedData[] = [];
    let aggregatedUsage = { promptTokens: 0, outputTokens: 0 };

    try {
      for (const [index, p] of previews.entries()) {
        console.log(`[handleProcess] Processing file ${index + 1} of ${previews.length}: ${p.name}`);
        if (cancelProcessingRef.current) {
          setError("処理がユーザーによって中断されました。");
          console.log('[handleProcess] Processing cancelled by user.');
          break;
        }
        const file = p.file;
        let pagesToProcess: { base64: string; mimeType: string; name: string }[] = [];

        if (p.type === 'pdf') {
          try {
            console.log(`[handleProcess] Reading PDF file as array buffer: ${file.name}`);
            const arrayBuffer = await readFileAsArrayBuffer(file);
            console.log(`[handleProcess] PDF file read. Getting document...`);
            const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
            const numPages = pdf.numPages;
            console.log(`[handleProcess] PDF document loaded successfully. Number of pages: ${numPages}`);

            for (let i = 1; i <= numPages; i++) {
              if (cancelProcessingRef.current) {
                setError("処理がユーザーによって中断されました。");
                console.log(`[handleProcess] Cancellation detected before processing page ${i}.`);
                break;
              }
              console.log(`[handleProcess] Processing PDF page ${i} of ${numPages}`);
              const page = await pdf.getPage(i);
              console.log(`[handleProcess] Page ${i} retrieved.`);
              const viewport = page.getViewport({ scale: 2 }); // Render at a higher scale for better OCR quality
              console.log(`[handleProcess] Page ${i} viewport created. Scale: 2, Width: ${viewport.width}, Height: ${viewport.height}`);

              const canvas = document.createElement('canvas');
              const context = canvas.getContext('2d');
              canvas.height = viewport.height;
              canvas.width = viewport.width;
              console.log(`[handleProcess] Canvas created for page ${i} with dimensions ${canvas.width}x${canvas.height}.`);

              if (!context) {
                throw new Error('Could not get canvas context for PDF page rendering');
              }

              console.log(`[handleProcess] Rendering page ${i} to canvas...`);
              await page.render({ canvasContext: context, viewport: viewport }).promise;
              console.log(`[handleProcess] Page ${i} rendered successfully.`);

              const canvasBuffer = await new Promise<ArrayBuffer>((resolve, reject) => {
                canvas.toBlob(blob => {
                  if (!blob) {
                    reject(new Error('Canvas to Blob conversion failed'));
                    return;
                  }
                  const reader = new FileReader();
                  reader.onload = () => resolve(reader.result as ArrayBuffer);
                  reader.onerror = reject;
                  reader.readAsArrayBuffer(blob);
                }, 'image/jpeg', 0.95);
              });

              const { base64, mimeType } = await window.electronAPI.processImageForOcr(canvasBuffer, preprocessingOptions);
              pagesToProcess.push({ base64, mimeType, name: `${file.name}_page_${i}` });
            }
          } catch (pdfError) {
            console.error(`[handleProcess] Error processing PDF file ${p.name}:`, pdfError);
            const errorMessage = pdfError instanceof Error ? pdfError.message : String(pdfError);
            throw new Error(`PDFファイル「${p.name}」の処理中にエラーが発生しました: ${errorMessage}`);
          }
        } else {
          // Image file
          console.log(`[handleProcess] Reading image file as array buffer: ${file.name}`);
          const arrayBuffer = await readFileAsArrayBuffer(file);
          console.log(`[handleProcess] Processing image with Jimp: ${file.name}`);
          console.log("window.electronAPI in App.tsx before calling processImageForOcr:", window.electronAPI);
          const { base64, mimeType } = await window.electronAPI.processImageForOcr(arrayBuffer, preprocessingOptions);
          pagesToProcess.push({ base64, mimeType, name: file.name });
          console.log(`[handleProcess] Image file processed: ${file.name}`);
        }

        if (cancelProcessingRef.current) break;

        for (const sourcePage of pagesToProcess) {
          if (cancelProcessingRef.current) break;

          console.log(`[handleProcess] Sending page ${sourcePage.name} to Gemini for OCR.`);
          const { data: result, usage } = await withRetry(() => processDocumentPages([sourcePage], documentType));
          
          if (usage) {
            aggregatedUsage.promptTokens += usage.promptTokens;
            aggregatedUsage.outputTokens += usage.outputTokens;
          }

          if (result && Array.isArray(result)) {
            console.log(`[handleProcess] Received ${result.length} data items from Gemini for page ${sourcePage.name}.`);
            
            // Associate sourceImageBase64 with each processed item
            const processedDataWithSource = result.map(item => {
              // All items in result belong to this sourcePage
              return { ...item, sourceImageBase64: `data:${sourcePage.mimeType};base64,${sourcePage.base64}` };
            });
            allExtractedData.push(...processedDataWithSource);
          } else {
            console.error(`[handleProcess] Gemini processing returned invalid or empty data for page ${sourcePage.name}:`, result);
          }
        }
      }

      setTokenUsage(aggregatedUsage);

      if (cancelProcessingRef.current) {
        setLoading(false);
        setError("処理がユーザーによって中断されました。");
        console.log('[handleProcess] Final check: Processing was cancelled.');
        return;
      }

      console.log('[handleProcess] Sanitizing and validating all extracted data.');
      const sanitizedAndValidatedData = allExtractedData.map((item: ProcessedData) => {
          if (item.type === 'timecard') {
            const card = item as ProcessedTimecard;
            if (!card || typeof card !== 'object' || !card.days) return null;
            const sanitizedCard: ProcessedTimecard = {
              type: 'timecard',
              title: { yearMonth: String(card.title?.yearMonth ?? ""), name: String(card.title?.name ?? "") },
              days: Array.isArray(card.days) ? card.days : [],
              nameCorrected: card.nameCorrected,
              sourceImageBase64: card.sourceImageBase64,
              rotation: 0
            };
            if (roster.length > 0) {
                const bestMatch = findBestMatch(sanitizedCard.title.name, roster);
                if (bestMatch && bestMatch !== sanitizedCard.title.name) {
                    sanitizedCard.title.name = bestMatch;
                    sanitizedCard.nameCorrected = true;
                }
            }
            return sanitizedCard;
          } else if (item.type === 'table') {
            const card = item as ProcessedTable;
            if (!card || typeof card !== 'object' || !card.headers || !card.data) return null;
            const sanitizedHeaders = Array.isArray(card.headers) ? card.headers.map(h => String(h ?? "")) : [];
            const headerCount = sanitizedHeaders.length;
            const sanitizedData = Array.isArray(card.data) ? card.data.map(row => {
                if (!Array.isArray(row)) return null;
                let sanitizedRow = row.map(cell => String(cell ?? ""));
                if (sanitizedRow.length < headerCount) {
                  sanitizedRow = [...sanitizedRow, ...Array(headerCount - sanitizedRow.length).fill("")];
                } else if (sanitizedRow.length > headerCount) {
                  sanitizedRow = sanitizedRow.slice(0, headerCount);
                }
                return sanitizedRow;
              }).filter((row): row is string[] => row !== null) : [];

            const sanitizedCard: ProcessedTable = { 
              type: 'table',
              title: { yearMonth: String(card.title?.yearMonth ?? ""), name: String(card.title?.name ?? "") },
              headers: sanitizedHeaders, data: sanitizedData,
              sourceImageBase64: card.sourceImageBase64,
              rotation: 0
            };
            
            if (roster.length > 0) {
                console.log(`[Name Correction] Original OCR Name for table: '${sanitizedCard.title.name}'`);
                const bestMatch = findBestMatch(sanitizedCard.title.name, roster);
                if (bestMatch && bestMatch !== sanitizedCard.title.name) {
                    sanitizedCard.title.name = bestMatch;
                    sanitizedCard.nameCorrected = true;
                }
            }
            return sanitizedCard;
          } else if (item.type === 'transcription') {
            const card: ProcessedText = {
              ...(item as ProcessedText),
              rotation: 0,
            };
            return card;
          }
          return null;
        }).filter((card): card is ProcessedData => card !== null);

      if (allExtractedData.length > 0 && sanitizedAndValidatedData.length === 0 && !cancelProcessingRef.current) {
        throw new Error("AIは応答しましたが、期待されるデータ形式と一致しませんでした。ファイルが対応形式であることを確認してください。");
      }

      if (!cancelProcessingRef.current) {
        setProcessedData(sanitizedAndValidatedData);
        if (sanitizedAndValidatedData.length > 0) {
          fetchAiSuggestions(sanitizedAndValidatedData);
        }
      }

    } catch (e: any) {
        console.error(e);
        if (!cancelProcessingRef.current) {
            const message = e.message || JSON.stringify(e);
            if (message.includes('503') || message.toLowerCase().includes('overloaded') || message.toLowerCase().includes('unavailable')) {
                setError("AIモデルが現在大変混み合っています。ご迷惑をおかけしますが、しばらく時間をおいてから再度お試しください。");
            } else {
                setError(`処理中に予期せぬエラーが発生しました:\n${message}`);
            }
        }
    } finally {
      setLoading(false);
    }
  };

  const handleDataChange = (cardIndex: number, rowIndex: number, cellIndex: number, value: string) => {
    setProcessedData(prevData => {
      const newData = JSON.parse(JSON.stringify(prevData));
      const item = newData[cardIndex];
      if (!item) return newData;
      if (item.type === 'table' && item.data[rowIndex]) {
        item.data[rowIndex][cellIndex] = value;
      } else if (item.type === 'timecard' && item.days) { // タイムカード形式でも既存の行のみを更新
          const day = item.days[rowIndex];
          const keys: (keyof TimecardDay)[] = ['date', 'dayOfWeek', 'morningStart', 'morningEnd', 'afternoonStart', 'afternoonEnd'];
          const key = keys[cellIndex];
          if (key) {
              (day[key] as string | null) = value || null;
          }
      }
      return newData;
    });
  };
  
  const handleContentChange = (cardIndex: number, value: string) => {
    setProcessedData(prevData => {
      const newData = JSON.parse(JSON.stringify(prevData));
      const item = newData[cardIndex];
      if (!item) return newData;
      if (item.type === 'transcription') {
        item.content = value;
      }
      return newData;
    });
  };

  const handleTitleChange = (cardIndex: number, field: 'yearMonth' | 'name', value: string) => {
    setProcessedData(prevData => {
      const newData = JSON.parse(JSON.stringify(prevData));
      const item = newData[cardIndex];
      if (!item) return newData;
      if ((item.type === 'table' || item.type === 'timecard') && item.title) {
        item.title[field] = value;
        if (field === 'name') {
            item.nameCorrected = false;
        }
      }
      return newData;
    });
  };

  const handleMoveCard = (index: number, direction: 'up' | 'down') => {
    setProcessedData(prevData => {
      const newData = [...prevData];
      const item = newData[index];
      const swapIndex = direction === 'up' ? index - 1 : index + 1;

      if (swapIndex < 0 || swapIndex >= newData.length) {
        return newData;
      }

      newData[index] = newData[swapIndex];
      newData[swapIndex] = item;
      return newData;
    });
  };

  const handleRotateImage = (cardIndex: number, direction: 'left' | 'right') => {
    setProcessedData(prevData => {
      const newData = [...prevData];
      const item = newData[cardIndex];
      if (item) {
        const currentRotation = item.rotation || 0;
        const newRotation = direction === 'right' 
          ? (currentRotation + 90) % 360
          : (currentRotation - 90 + 360) % 360;
        newData[cardIndex] = { ...item, rotation: newRotation };
      }
      return newData;
    });
  };

  const handleRowCreate = (cardIndex: number, rowIndex: number, amount: number) => {
    setProcessedData(prevData => {
      const newData = JSON.parse(JSON.stringify(prevData));
      const item = newData[cardIndex];
      if (!item) return newData;
      if (item.type === 'timecard' && item.days) {
        // 新しい空の行を挿入
        const newEmptyRow = {
          date: '', dayOfWeek: '', morningStart: '', morningEnd: '',
          afternoonStart: '', afternoonEnd: ''
        };
        item.days.splice(rowIndex, 0, ...Array(amount).fill(newEmptyRow));
      } else if (item.type === 'table' && item.data) {
        // 新しい空の行を挿入
        const newEmptyRow = Array(item.headers.length).fill('');
        item.data.splice(rowIndex, 0, ...Array(amount).fill(newEmptyRow));
      }
      return newData;
    });
  };

  const handleRowRemove = (cardIndex: number, rowIndex: number, amount: number) => {
    setProcessedData(prevData => {
      const newData = JSON.parse(JSON.stringify(prevData));
      const item = newData[cardIndex];
      if (!item) return newData;
      if (item.type === 'timecard' && item.days) {
        item.days.splice(rowIndex, amount);
      } else if (item.type === 'table' && item.data) {
        item.data.splice(rowIndex, amount);
      }
      return newData;
    });
  };

  const handleColCreate = (cardIndex: number, colIndex: number, amount: number) => {
    setProcessedData(prevData => {
      const newData = JSON.parse(JSON.stringify(prevData));
      const item = newData[cardIndex];
      if (!item) return newData;
      if (item.type === 'table' && item.headers && item.data) {
        // ヘッダーに新しい列を追加
        for (let i = 0; i < amount; i++) {
          item.headers.splice(colIndex + i, 0, '');
        }
        // 各行に新しいセルを追加
        item.data.forEach((row: string[]) => {
          for (let i = 0; i < amount; i++) {
            row.splice(colIndex + i, 0, '');
          }
        });
      }
      return newData;
    });
  };

  const handleColRemove = (cardIndex: number, colIndex: number, amount: number) => {
    setProcessedData(prevData => {
      const newData = JSON.parse(JSON.stringify(prevData));
      const item = newData[cardIndex];
      if (!item) return newData;
      if (item.type === 'table' && item.headers && item.data) {
        // ヘッダーから列を削除
        item.headers.splice(colIndex, amount);
        // 各行からセルを削除
        item.data.forEach((row: string[]) => {
          row.splice(colIndex, amount);
        });
      } else if (item.type === 'timecard' && item.days) {
        // This is more complex as timecard doesn't have dynamic columns
        // We'd need to null out the data in the specific column
      }
      return newData;
    });
  };

  const handleAiOperation = (operation: { operation: string; params: any }, targetIndices: number[] | 'all') => {
    if (!operation || !operation.operation) return;

    const { operation: opName, params } = operation;
    console.log(`Executing AI operation: ${opName} on targets: ${targetIndices}`, JSON.stringify(params, null, 2));

    let newData = JSON.parse(JSON.stringify(processedData));
    let updateRequired = false;

    const indicesToProcess = targetIndices === 'all' 
      ? processedData.map((_, i) => i) 
      : (Array.isArray(targetIndices) ? targetIndices : []);

    (indicesToProcess || []).forEach(cardIndex => {
      const targetCard = newData[cardIndex];
      if (!targetCard) return;

      // タイムカードとテーブルの両方で機能する操作をここに記述
      // 例: delete_card (仮)

      // テーブル専用の操作
      if (targetCard.type === 'table') {
        switch (opName) {
          case 'add_column_with_data': {
    if (!params.header || !params.data || !Array.isArray(params.data)) {
        setError(`「${opName}」操作のパラメータが不完全です。'header'と'data'が必要です。`);
        break;
    }

    const header = String(params.header);
    const colIndex = targetCard.headers.indexOf(header);
    const formula = params.data[0] as string;

    // Check for simple formula like =A2-B2 or =A2+B2
    const formulaMatch = typeof formula === 'string' ? formula.match(/^=([A-Z]+)(\d+)([+\-])([A-Z]+)(\d+)$/) : null;

    if (formulaMatch) {
        const [, col1Letter, , operator, col2Letter] = formulaMatch;
        const col1Index = columnToIndex(col1Letter);
        const col2Index = columnToIndex(col2Letter);

        if (col1Index === -1 || col2Index === -1) {
            setError(`AIが提案した計算式に無効な列が含まれています: ${col1Letter}, ${col2Letter}`);
            break;
        }

        if (colIndex === -1) { // New column
            targetCard.headers.push(header);
            targetCard.data.forEach((row: string[]) => {
                const val1 = parseFloat(String(row[col1Index] || '0').replace(/[^0-9.-]+/g, ''));
                const val2 = parseFloat(String(row[col2Index] || '0').replace(/[^0-9.-]+/g, ''));
                if (!isNaN(val1) && !isNaN(val2)) {
                    const result = operator === '+' ? val1 + val2 : val1 - val2;
                    row.push(String(result));
                } else {
                    row.push(''); // Push empty string if values are not numbers
                }
            });
        } else { // Existing column
            targetCard.data.forEach((row: string[]) => {
                const val1 = parseFloat(String(row[col1Index] || '0').replace(/[^0-9.-]+/g, ''));
                const val2 = parseFloat(String(row[col2Index] || '0').replace(/[^0-9.-]+/g, ''));
                if (!isNaN(val1) && !isNaN(val2)) {
                    const result = operator === '+' ? val1 + val2 : val1 - val2;
                    row[colIndex] = String(result);
                } else {
                    row[colIndex] = ''; // Set empty string if values are not numbers
                }
            });
        }
        updateRequired = true;

    } else { // Default behavior if not a formula
        if (colIndex === -1) { // New column
            targetCard.headers.push(header);
            targetCard.data.forEach((row: string[], rowIndex: number) => {
                row.push(String(params.data[rowIndex] ?? params.data[0] ?? ''));
            });
        } else { // Existing column
            targetCard.data.forEach((row: string[], rowIndex: number) => {
                const valueToSet = params.data[rowIndex] ?? params.data[0];
                if (valueToSet !== undefined) {
                    row[colIndex] = String(valueToSet);
                }
            });
        }
        updateRequired = true;
    }
    break;
}
          case 'delete_rows': {
              let indicesToDelete: number[] = [];
              if (params.row_indices && Array.isArray(params.row_indices)) {
                  indicesToDelete = params.row_indices;
              } else if (typeof params.start_row === 'number' && typeof params.end_row === 'number') {
                  // AIが start_row/end_row 形式で返してきた場合に対応
                  const start = Math.max(0, params.start_row);
                  const end = Math.min(targetCard.data.length - 1, params.end_row);
                  for (let i = start; i <= end; i++) {
                      indicesToDelete.push(i);
                  }
              } else if (params.all === true) {
                  // 「すべて削除」のような指示に対応
                  indicesToDelete = Array.from({ length: targetCard.data.length }, (_, i) => i);
              }

              if (indicesToDelete.length > 0) {
                  // 降順にソートして、後ろから削除することでインデックスのズレを防ぐ
                  const sortedIndices = [...new Set(indicesToDelete)].sort((a, b) => b - a);
                  sortedIndices.forEach((rowIndex: number) => {
                      if (rowIndex >= 0 && rowIndex < targetCard.data.length) {
                          targetCard.data.splice(rowIndex, 1);
                          updateRequired = true;
                      }
                  });
              } else {
                  console.warn('delete_rows operation was called without valid parameters.', params);
                  setError('行の削除操作で、対象となる行が指定されませんでした。');
              }
              break;
          }
          case 'delete_empty_rows': {
              const originalRowCount = targetCard.data.length;
              targetCard.data = targetCard.data.filter((row: string[]) => 
                  row.some(cell => cell && String(cell).trim() !== '')
              );
              if (targetCard.data.length !== originalRowCount) {
                  updateRequired = true;
              }
              break;
          }
          case 'calculate_totals': {
              if (params.columns && Array.isArray(params.columns) && params.columns.length > 0) {
                  const newTotalRow = new Array(targetCard.headers.length).fill('');
                  let hasCalculated = false;

                  params.columns.forEach((colName: string) => {
                      const colIndex = targetCard.headers.indexOf(colName);
                      if (colIndex !== -1) {
                          const total = targetCard.data.reduce((sum: number, row: string[]) => {
                              const val = parseFloat(String(row[colIndex]).replace(/[^0-9.-]+/g, '')) || 0;
                              return sum + val;
                          }, 0);
                          
                          newTotalRow[colIndex] = total.toLocaleString();
                          if (!hasCalculated) {
                              const labelCol = Math.max(0, colIndex - 1);
                              newTotalRow[labelCol] = '合計';
                              hasCalculated = true;
                          }
                      }
                  });
                  
                  if (hasCalculated) {
                      targetCard.data.push(newTotalRow);
                      updateRequired = true;
                  }
              } else {
                  console.warn('calculate_totals was called without valid `columns` parameter.', params);
                  setError('合計を計算する列の指定がAIからありませんでした。');
              }
              break;
          }
          case 'create_journal_entry': {
              const newHeaders = ['借方勘定科目', '借方金額', '貸方勘定科目', '貸方金額', '摘要'];
              newHeaders.forEach(h => {
                  if (!targetCard.headers.includes(h)) {
                      targetCard.headers.push(h);
                      updateRequired = true;
                  }
              });
              targetCard.data.forEach((row: string[]) => {
                  while (row.length < targetCard.headers.length) {
                      row.push('');
                  }
              });
              break;
          }
          default:
              setError(`テーブル操作「${opName}」はまだ実装されていません。`);
              console.warn(`Unknown AI table operation: ${opName}`);
              break;
        }
      } else if (targetCard.type === 'timecard') {
        // タイムカード専用の操作をここに記述
        switch (opName) {
          // ... TBD
          default:
            setError(`タイムカード操作「${opName}」はまだ実装されていません。`);
            console.warn(`Unknown AI timecard operation: ${opName}`);
            break;
        }
      }
    });

    if (updateRequired) {
      setProcessedData(newData);
    }
  };

  const handleAiSendMessage = async () => {
    const trimmedInput = aiUserInput.trim();
    if (!trimmedInput || !window.electronAPI?.invokeAiChat) return;

    const newMessages: ChatMessage[] = [...aiMessages, { role: 'user', content: trimmedInput }];
    setAiMessages(newMessages);
    setAiUserInput('');
    setIsAiManualLoading(true);

    const spreadsheets = processedData.filter(d => d.type === 'table' || d.type === 'timecard');
    const targetData = spreadsheets.length > 0 ? spreadsheets[0] : null;

    const buildPrompt = (input: string, history: ChatMessage[], data: ProcessedData | null) => {
        const historyString = history.map(m => `${m.role}: ${m.content}`).join('\n');
        const dataString = data ? `\n\n現在のスプレッドシートデータ (JSON):\n${JSON.stringify(data, null, 2)}` : '';

        return `
あなたは、ユーザーの指示を分析し、2つのモードのうちの1つで応答する高度なAIアシスタントです。

--- 会話履歴 ---
${historyString}
${dataString}

--- ルール ---
1.  ユーザーの最新のメッセージ（"user: ${input}"）を分析してください。
2.  メッセージがスプレッドシートの操作（計算、列の追加、データの検索など）を指示している場合、**操作モード**で応答します。
3.  メッセージが一般的な質問、挨拶、または会話である場合、**チャットモード**で応答します。
4.  応答は必ず指定されたJSON形式のみで、他のテキストは一切含めないでください。

--- 応答形式 ---

*   **チャットモードの場合:**
    ユーザーへの返答メッセージを含むJSONを返します。
    \`\`\`json
    {"operation": "chat", "params": {"response": "ここに会話の応答メッセージを記述"}}
    \`\`\`

*   **操作モードの場合:**
    実行すべき操作を定義したJSONを返します。利用可能な操作は以下の通りです。
    - add_column_with_data: 新しい列を追加し、データを入力します。params: { "header": "列名", "data": ["セル1", "セル2", ...] }
    - delete_rows: 行を削除します。params: { "row_indices": [0, 2, 3] }
    - calculate_totals: 列の合計を計算します。params: { "columns": ["列名1"] }
    - delete_empty_rows: 空の行を削除します。
    - create_journal_entry: 仕訳用の列を追加します。

    操作モードのJSON出力例:
    \`\`\`json
    {"operation": "add_column_with_data", "params": {"header": "新しい列", "data": ["=A2+B2"]}}
    \`\`\`

--- あなたの応答 ---
`;
    };

    try {
      const prompt = buildPrompt(trimmedInput, newMessages, targetData);
      const result = await window.electronAPI.invokeAiChat({ prompt });

      if (!result.success) {
        const errorMessage = result.error ?? 'AIアシスタントからの応答がありませんでした。';
        setAiMessages(prev => [...prev, { role: 'assistant', content: `エラー: ${errorMessage}` }]);
        return;
      }

      const content = result.data?.choices?.[0]?.message?.content ?? '';
      const parsed = extractJson(content);

      if (parsed && typeof parsed === 'object' && 'operation' in parsed) {
        const operationData = parsed as SuggestedOperation;

        if (operationData.operation === 'chat') {
          const chatResponse = (operationData.params as any)?.response ?? 'チャット応答が空です。';
          setAiMessages(prev => [...prev, { role: 'assistant', content: chatResponse }]);
        } else {
          // デフォルトのターゲットは最初のスプレッドシート
          const targetSpreadsheetIndex = processedData.findIndex(d => d.type === 'table' || d.type === 'timecard');
          const target = targetSpreadsheetIndex !== -1 ? [targetSpreadsheetIndex] : [0];
          handleAiOperation(operationData, target);
          setAiMessages(prev => [...prev, { role: 'assistant', content: `操作「${operationData.name || operationData.operation}」を実行しました。` }]);
        }
      } else {
        const fallback = content || 'AIは応答しましたが、有効な操作または会話を特定できませんでした。';
        setAiMessages(prev => [...prev, { role: 'assistant', content: fallback }]);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      setAiMessages(prev => [...prev, { role: 'assistant', content: `エラー: ${errorMessage}` }]);
    } finally {
      setIsAiManualLoading(false);
    }
  };


  const handleDownloadAll = async () => {
    for (const item of processedData) {
      await handleDownloadSingle(item);
    }
  };

  const handleDownloadSingle = async (item: ProcessedData) => {
    if (!window.electronAPI) {
        setError("ファイル保存機能が利用できません。");
        return;
    }
    setError(null);

    try {
        if (item.type === 'timecard') {
            const card = item as ProcessedTimecard;
            if (outputMode === 'template') {
                if (!excelTemplateFile?.path || !excelTemplateData) {
                    setError('タイムカードをテンプレートに転記するには、Excelテンプレートファイルを指定してください。');
                    return;
                }

                const tempWb = XLSX.read(excelTemplateData, { type: 'buffer' });
                const allOperations: any[] = [];
                const unmatchedNames: string[] = [];

                processedData.filter((d): d is ProcessedTimecard => d.type === 'timecard').forEach((card: ProcessedTimecard) => {
                    const targetSheetName = findMatchingSheetName(card.title.name, tempWb.SheetNames);
                    if (targetSheetName) {
                        const transformed = transformTimecardJsonForExcelHandler(card, excelTemplateFile.path, targetSheetName, templateSettings.dataStartCell);
                        allOperations.push(...transformed.operations);
                    } else {
                        unmatchedNames.push(card.title.name);
                    }
                });

                if (allOperations.length > 0) {
                    const pythonArgs = {
                        action: 'write_template',
                        template_path: excelTemplateFile.path,
                        operations: allOperations
                    };
                    const result = await (window.electronAPI as any).runPythonScript({
                        args: pythonArgs,
                    });

                    if (result.success && result.message) {
                        if (excelTemplateFile?.path) {
                            await window.electronAPI.openFile(excelTemplateFile.path);
                        }
                    } else if (result.error) {
                        throw new Error(result.error);
                    }
                } else {
                    if (unmatchedNames.length > 0) {
                        setError(`転記対象のデータが見つかりませんでした。テンプレートに一致するシート名がありませんでした: ${unmatchedNames.join(', ')}`);
                    } else {
                        setError('転記対象のデータが見つかりませんでした。');
                    }
                }
            } else {
                const wb = XLSX.utils.book_new();
                const sheetName = `${card.title.yearMonth} ${card.title.name}`.replace(/[\\|/:*?"<>|]/g, '').substring(0, 31);
                const ws_data = [
                    ['期間', card.title.yearMonth],
                    ['氏名', card.title.name],
                    [],
                    ['日付', '曜日', '午前 出勤', '午前 退勤', '午後 出勤', '午後 退勤']
                ];
                card.days.forEach(day => {
                    ws_data.push([
                        day.date,
                        day.dayOfWeek || '',
                        day.morningStart || '',
                        day.morningEnd || '',
                        '',
                        day.afternoonStart || '',
                        day.afternoonEnd || '',
                    ]);
                });
                const ws = XLSX.utils.aoa_to_sheet(ws_data);
                XLSX.utils.book_append_sheet(wb, ws, sheetName);
                const fileData = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
                const uint8FileData = new Uint8Array(fileData);
                const fileName = `${card.title.name.replace(/\s+/g, '')}_${card.title.yearMonth.replace(/\s+/g, '')}.xlsx`.replace(/[\\|/:*?"<>|]/g, '_') || 'Timecard.xlsx';
                const savedFilePath = await window.electronAPI.saveFile({ defaultPath: fileName }, uint8FileData);
                if (savedFilePath && savedFilePath.path) {
                    const openFileResult = await window.electronAPI.openFile(savedFilePath.path);
                }
            }

        } else if (item.type === 'table') {
            const card = item as ProcessedTable;
            const fileNameBase = `${card.title.name.replace(/\s+/g, '')}_${card.title.yearMonth.replace(/\s+/g, '')}`.replace(/[\\|/:*?"<>|]/g, '_') || 'Document';

            let fileData: Uint8Array;
            let fileName: string = '';

            if (outputMode === 'template') {
                if (!excelTemplateData || !templateSettings.dataStartCell) {
                    setError('テンプレートファイルとデータ開始セルを指定してください。');
                    return;
                }
                const outputBookType = excelTemplateFile?.name.endsWith('.xlsm') ? 'xlsm' : 'xlsx';
                const tempWb = XLSX.read(excelTemplateData, { type: 'buffer' });
                const newWb = XLSX.read(XLSX.write(tempWb, { type: 'array', bookType: outputBookType }), { type: 'array' });
                const dataBySheet = new Map<string, string[][]>();
                const unmatchedNames: string[] = [];
                processedData.filter((d): d is ProcessedTable => d.type === 'table').forEach((card: ProcessedTable) => {
                    const targetSheetName = findMatchingSheetName(card.title.name, newWb.SheetNames);
                    if (targetSheetName) {
                        dataBySheet.set(targetSheetName, card.data);
                    } else {
                        unmatchedNames.push(card.title.name);
                    }
                });

                newWb.SheetNames.forEach((sheetName: string) => {
                    const newSheet = newWb.Sheets[sheetName];
                    if (dataBySheet.has(sheetName) && newSheet) {
                        XLSX.utils.sheet_add_aoa(newSheet, dataBySheet.get(sheetName)!, { origin: templateSettings.dataStartCell });
                    }
                });

                fileData = XLSX.write(newWb, { bookType: outputBookType, type: 'array' });
                fileName = `${fileNameBase}_template_filled.${outputBookType}`;
                const savedFilePath = await window.electronAPI.saveFile({ defaultPath: fileName }, fileData);
                if (savedFilePath && savedFilePath.path) {
                    await window.electronAPI.openFile(savedFilePath.path);
                }
                
                if (unmatchedNames.length > 0) {
                    setError(`転記が完了しましたが、一部の氏名のシートが見つかりませんでした。
未転記: ${unmatchedNames.join(', ')}`);
                } else {
                    setError(null);
                }
            } else {
                const wb = XLSX.utils.book_new();
                processedData.filter((d): d is ProcessedTable => d.type === 'table').forEach((card: ProcessedTable) => {
                  const sheetName = `${card.title.yearMonth} ${card.title.name}`.replace(/[\\|/:*?"<>|]/g, '').substring(0, 31);
                  const ws_data = [['期間', card.title.yearMonth], ['件名', card.title.name], [], card.headers, ...card.data];
                  const ws = XLSX.utils.aoa_to_sheet(ws_data);
                  XLSX.utils.book_append_sheet(wb, ws, sheetName);
                });
                const fileData = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
                const uint8FileData = new Uint8Array(fileData);
                const fileName = 'Documents_All.xlsx';
                const savedFilePath = await window.electronAPI.saveFile({ defaultPath: fileName }, uint8FileData);
                if (savedFilePath && savedFilePath.path) {
                    await window.electronAPI.openFile(savedFilePath.path);
                }
            }

        } else if (item.type === 'transcription') {
            const textItem = item as ProcessedText;
            const wb = XLSX.utils.book_new();
            const sheetName = textItem.fileName.replace(/\.[^/.]+$/, "").substring(0, 31) || 'Transcription';
            const ws_data = [[item.content]];
            const ws = XLSX.utils.aoa_to_sheet(ws_data);
            XLSX.utils.book_append_sheet(wb, ws, sheetName);
            const fileData = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
            const uint8FileData = new Uint8Array(fileData);
            const fileName = `${textItem.fileName.replace(/\.[^/.]+$/, "")}.xlsx`;
            const savedFilePath = await window.electronAPI.saveFile({
                defaultPath: fileName,
                filters: [{ name: 'Excel Files', extensions: ['xlsx'] }]
            }, uint8FileData);
            if (savedFilePath && savedFilePath.path) {
                await window.electronAPI.openFile(savedFilePath.path);
            }
        }
    } catch (err: any) {
        setError(`一括保存中にエラーが発生しました: ${err.message}`);
        console.error(err);
    }
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('.hot-container')) {
      return;
    }
    e.preventDefault();
    window.electronAPI?.showContextMenu();
  };

  return (
    <div className="min-h-screen flex flex-col items-center p-4 sm:p-6 lg:p-8">
      <div className="w-full mx-auto">
        <header className="text-center mb-8">
          <div className="flex justify-center items-center gap-4 mb-4">
            <img src={owlIcon} alt="アプリアイコン" className="w-20 h-20" />
            <h1 className="text-3xl sm:text-4xl font-bold text-gray-800">ALCS文書OCR</h1>
            <img src={owlIcon} alt="アプリアイコン" className="w-20 h-20" />
          </div>
          <p className="mt-2 text-sm text-gray-600 leading-relaxed">
            画像(PNG, JPG, PDF)をアップロードすると、AIが内容を読み取りデータ化します。<br />
            認識結果は画面上で修正し、Excelファイルとしてダウンロード可能です。
          </p>
        </header>

        <main className="space-y-6">
          <div className="p-6 bg-white rounded-lg shadow-md space-y-6">
            <div>
              <h2 className="text-lg font-semibold text-gray-700 mb-4">1. 帳票の種類を選択し、ファイルをアップロード</h2>
              <div className="mb-4">
                <label htmlFor="document-type" className="block text-sm font-medium text-gray-700 mb-2">
                  帳票種別
                </label>
                <select
                  id="document-type"
                  name="document-type"
                  value={documentType}
                  onChange={(e) => setDocumentType(e.target.value)}
                  className="block w-full max-w-xs rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                >
                  <option>タイムカード</option>
                  <option>日計表</option>
                  <option>領収書</option>
                  <option>銀行通帳</option>
                  <option>その他（汎用テーブル）</option>
                </select>
              </div>
              <MultiFileUploader onFilesUpload={handleFilesUpload} previews={previews} onRemoveFile={handleRemoveFile} onClearAll={handleClearAll} onPreviewClick={handlePreviewClick} />
            </div>

            <div className='space-y-4'>
                <details className="group rounded-lg bg-gray-50 p-4 transition-all duration-300 open:ring-1 open:ring-gray-200">
                    <summary className="flex cursor-pointer list-none items-center justify-between text-lg font-semibold text-gray-700">
                        <div className="flex items-center gap-3">
                            <span>画像の前処理設定 (オプション)</span>
                        </div>
                        <ChevronDownIcon className="h-5 w-5 text-gray-500 transition-transform duration-300 group-open:rotate-180" />
                    </summary>
                    <div className="mt-4 border-t pt-4 space-y-3">
                        <p className="text-sm text-gray-600">OCRの認識精度を向上させるため、APIに送信する前に画像を自動で加工します。画像の特性によってはOFFにすると精度が向上する場合もあります。</p>
                        <div className="mt-2 space-y-2">
                            <div className="relative flex items-start">
                                <div className="flex h-6 items-center">
                                    <input id="isAutocropEnabled" name="isAutocropEnabled" type="checkbox" checked={preprocessingOptions.isAutocropEnabled} onChange={handlePreprocessingOptionsChange} className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-600" />
                                </div>
                                <div className="ml-3 text-sm leading-6">
                                    <label htmlFor="isAutocropEnabled" className="font-medium text-gray-900">余白の自動トリミング</label>
                                    <p className="text-gray-500">画像の不要な余白を自動で除去し、OCRの認識範囲を最適化します。</p>
                                </div>
                            </div>
                            <div className="relative flex items-start">
                                <div className="flex h-6 items-center">
                                    <input id="isContrastAdjustmentEnabled" name="isContrastAdjustmentEnabled" type="checkbox" checked={preprocessingOptions.isContrastAdjustmentEnabled} onChange={handlePreprocessingOptionsChange} className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-600" />
                                </div>
                                <div className="ml-3 text-sm leading-6">
                                    <label htmlFor="isContrastAdjustmentEnabled" className="font-medium text-gray-900">コントラストの自動調整</label>
                                    <p className="text-gray-500">画像のコントラストを調整し、文字をより鮮明にします。</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </details>

                <details className="group rounded-lg bg-gray-50 p-4 transition-all duration-300 open:ring-1 open:ring-gray-200">
                    <summary className="flex cursor-pointer list-none items-center justify-between text-lg font-semibold text-gray-700">
                        <div className="flex items-center gap-3">
                            <span>氏名読み取り精度向上 (オプション)</span>
                        </div>
                        <ChevronDownIcon className="h-5 w-5 text-gray-500 transition-transform duration-300 group-open:rotate-180" />
                    </summary>
                    <div className="mt-4 border-t pt-4 space-y-3">
                        <p className="text-sm text-gray-600">氏名が記載されたExcelファイル（名簿）をアップロードすると、OCRが読み取った氏名を自動で補正します。名簿のシート名と氏名が記載されている列を指定してください。</p>
                        <div className="flex items-center gap-4">
                            <label htmlFor="roster-upload" className="cursor-pointer rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50" onClick={handleRosterUpload}>名簿ファイルを選択</label>
                            {rosterFile && (
                                <div className="flex items-center gap-2">
                                    <span className="text-sm text-gray-700">{rosterFile.name} ({roster.length}名)</span>
                                    <button
                                        onClick={() => { setRosterFile(null); setRoster([]); setError(null); }}
                                        className="p-0.5 bg-red-600 text-white rounded-full hover:bg-red-700"
                                        aria-label="名簿ファイルをクリア"
                                    >
                                        <CloseIcon className="w-4 h-4" />
                                    </button>
                                </div>
                            )}
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                             <div><label htmlFor="rosterSheetName" className="block text-sm font-medium leading-6 text-gray-900">シート名 (空欄で最初のシート)</label><input type="text" name="sheetName" id="rosterSheetName" value={rosterSettings.sheetName} onChange={handleRosterSettingsChange} className="block w-full rounded-md border-0 py-1.5 px-2 text-gray-900 bg-white shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6" placeholder="例: 社員一覧" /></div>
                             <div><label htmlFor="rosterColumn" className="block text-sm font-medium leading-6 text-gray-900">氏名が記載されている列または範囲</label><input type="text" name="column" id="rosterColumn" value={rosterSettings.column} onChange={handleRosterSettingsChange} className="block w-full rounded-md border-0 py-1.5 px-2 text-gray-900 bg-white shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6" placeholder="例: B または B2:B50" /></div>
                        </div>
                    </div>
                </details>

                <details className="group rounded-lg bg-gray-50 p-4 transition-all duration-300 open:ring-1 open:ring-gray-200">
                    <summary className="flex cursor-pointer list-none items-center justify-between text-lg font-semibold text-gray-700">
                        <div className="flex items-center gap-3">
                            <span>Excel出力設定</span>
                        </div>
                        <ChevronDownIcon className="h-5 w-5 text-gray-500 transition-transform duration-300 group-open:rotate-180" />
                    </summary>
                    <div className="mt-4 space-y-4 border-t pt-4">
                        <fieldset>
                            <legend className="text-sm font-medium text-gray-900">出力方法を選択してください (表形式データのみ)</legend>
                            <div className="mt-2 flex gap-8">
                                <div className="flex items-center gap-x-3"><input id="output-new" name="output-mode" type="radio" value="new" checked={outputMode === 'new'} onChange={() => setOutputMode('new')} className="h-4 w-4 border-gray-300 text-blue-600 focus:ring-blue-600" /><label htmlFor="output-new" className="block text-sm font-medium leading-6 text-gray-900">新規Excelファイルを作成</label></div>
                                <div className="flex items-center gap-x-3"><input id="output-template" name="output-mode" type="radio" value="template" checked={outputMode === 'template'} onChange={() => setOutputMode('template')} className="h-4 w-4 border-gray-300 text-blue-600 focus:ring-blue-600" /><label htmlFor="output-template" className="block text-sm font-medium leading-6 text-gray-900">既存のExcelファイルに転記</label></div>
                            </div>
                        </fieldset>

                        {outputMode === 'template' && (
                            <div className="space-y-4 rounded-md border bg-white p-4">
                                <p className="text-sm text-gray-600">テンプレートモードでは、OCRで読み取った氏名と一致する名前のシートに、勤怠データ（ヘッダーを除く）のみを転記します。データの書き込みを開始するセルを指定してください。</p>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">テンプレートExcelファイル</label>
                                    <div className="flex items-center gap-4">
                                        <button 
                                            type="button"
                                            onClick={handleTemplateSelect}
                                            className="cursor-pointer rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
                                        >
                                            ファイルを選択
                                        </button>
                                        {excelTemplateFile && (
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm text-gray-700">{excelTemplateFile.name}</span>
                                                <button
                                                    onClick={() => { setExcelTemplateFile(null); setExcelTemplateData(null); setError(null); }}
                                                    className="p-0.5 bg-red-600 text-white rounded-full hover:bg-red-700"
                                                    aria-label="テンプレートファイルをクリア"
                                                >
                                                    <CloseIcon className="w-4 h-4" />
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
                                     <div><label htmlFor="dataStartCell" className="block text-sm font-medium leading-6 text-gray-900">データ書き込み開始セル</label><input type="text" name="dataStartCell" id="dataStartCell" value={templateSettings.dataStartCell} onChange={handleTemplateSettingsChange} className="block w-full rounded-md border-0 py-1.5 px-2 text-gray-900 bg-white shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6" placeholder="例: C5" /></div>
                                </div>
                                <p className="text-sm text-gray-600 mt-2">
                                    ※タイムカードデータは「午前出勤」「午前退勤」「午後出勤」「午後退勤」の4列のみが転記されます。<br />
                                    テンプレートの日付や氏名などの既存情報を上書きしないよう、勤怠データが始まるセル（例: C5）を正確に指定してください。
                                </p>
                            </div>
                        )}
                    </div>
                </details>
            </div>

          </div>
          
          <div className="text-center flex justify-center items-center gap-4">
            <button
              onClick={handleProcess}
              disabled={loading || previews.length === 0}
              className="w-full sm:w-auto inline-flex justify-center items-center px-8 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {loading ? ( <> <ProcessingIcon className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" /> 処理中... </> ) : '2. 処理を開始'}
            </button>
            {loading && (
              <button
                onClick={() => {
                  cancelProcessingRef.current = true;
                  setIsCancelling(true);
                }}
                className="w-full sm:w-auto inline-flex justify-center items-center px-8 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-red-600 hover:bg-red-700"
                disabled={isCancelling}
              >
                {isCancelling ? '処理を中止中...' : '処理を中止'}
              </button>
            )}
          </div>
          
          {error && (
            <div className="p-4 bg-red-100 text-red-700 border border-red-400 rounded-md">
              <h3 className="font-bold">エラーが発生しました</h3>
              <pre className="mt-2 whitespace-pre-wrap text-sm">{error}</pre>
            </div>
          )}

          {processedData.length > 0 && (
            <div className="mt-6">
              <div className="relative max-w-4xl mx-auto mb-12 px-4 sm:px-0">
                <AiAssistant 
                  suggestedOperations={suggestedOperations}
                  isLoading={isSuggestionLoading || isAiManualLoading}
                  messages={aiMessages}
                  userInput={aiUserInput}
                  onUserInput={setAiUserInput}
                  onSendMessage={handleAiSendMessage}
                  onExecuteOperation={(operation) => handleAiOperation(operation, 'all')}
                />
              </div>

              <div ref={resultsRef}>
                <Suspense fallback={<div>Loading...</div>}> 
                  <div className="flex flex-wrap justify-between items-center gap-4 mb-4">
                    <h2 className="text-lg font-semibold text-gray-700">3. 結果の確認と修正</h2>
                    <div className="flex items-center gap-2">
                      <button
                          onClick={handleDownloadAll}
                          disabled={processedData.every(d => d.type === 'transcription')}
                          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                      >
                          <DownloadIcon className="-ml-1 mr-2 h-5 w-5" />
                          すべてダウンロード
                      </button>
                    </div>
                  </div>

                  {tokenUsage && (tokenUsage.promptTokens > 0 || tokenUsage.outputTokens > 0) && (
                    <div className="text-xs text-gray-500 my-2 p-2 bg-gray-50 rounded-md">
                      <p className="font-semibold">APIトークン使用量 (参考値):</p>
                      <p>・入力: {tokenUsage.promptTokens.toLocaleString()} トークン</p>
                      <p>・出力: {tokenUsage.outputTokens.toLocaleString()} トークン</p>
                    </div>
                  )}

                  <div className="space-y-8">
                    {processedData.map((item, index) => {
                      const renderSpreadsheet = (item: ProcessedData, index: number) => (
                          <div className="w-full h-full overflow-x-auto p-2">
                            {item.type === 'table' ? (
                              <>
                                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 mb-2">
                                    <div className="flex items-center gap-2 text-xl font-bold text-gray-800 flex-grow min-w-0">
                                        <input type="text" value={item.title.yearMonth} onChange={(e) => handleTitleChange(index, 'yearMonth', e.target.value)} className="p-1 border border-transparent hover:border-gray-300 focus:border-blue-500 rounded-md bg-transparent w-auto" aria-label="Edit Year and Month" />
                                        <span className="text-gray-500">-</span>
                                        <div className="flex items-center gap-1.5 flex-grow min-w-0">
                                            {item.nameCorrected && <SparklesIcon className="h-5 w-5 text-blue-500 flex-shrink-0" title="名簿により自動修正" />}
                                            <input type="text" value={item.title.name} onChange={(e) => handleTitleChange(index, 'name', e.target.value)} className="p-1 border border-transparent hover:border-gray-300 focus:border-blue-500 rounded-md bg-transparent w-full" aria-label="Edit Name" />
                                        </div>
                                    </div>
                                    <div className="w-full flex justify-end sm:w-auto sm:justify-start">
                                        <button onClick={() => handleDownloadSingle(item)} className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 flex-shrink-0" aria-label={`${item.title.name}のテーブルをダウンロード`}>
                                            <DownloadIcon className="-ml-0.5 mr-2 h-4 w-4" />
                                            Excelでダウンロード
                                        </button>
                                    </div>
                                </div>
                                <DataTable 
                                    cardIndex={index} 
                                    headers={item.headers}
                                    data={item.data}
                                    errors={item.errors}
                                    onDataChange={handleDataChange} 
                                    onRowCreate={handleRowCreate}
                                    onRowRemove={handleRowRemove}
                                    onColCreate={handleColCreate}
                                    onColRemove={handleColRemove}
                                />
                              </>
                            ) : item.type === 'timecard' ? (
                                <>
                                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 mb-2">
                                        <div className="flex items-center gap-2 text-xl font-bold text-gray-800 flex-grow min-w-0">
                                            <input type="text" value={item.title.yearMonth} onChange={(e) => handleTitleChange(index, 'yearMonth', e.target.value)} className="p-1 border border-transparent hover:border-gray-300 focus:border-blue-500 rounded-md bg-transparent w-auto" aria-label="Edit Year and Month" />
                                            <span className="text-gray-500">-</span>
                                            <div className="flex items-center gap-1.5 flex-grow min-w-0">
                                                {item.nameCorrected && <SparklesIcon className="h-5 w-5 text-blue-500 flex-shrink-0" title="名簿により自動修正" />}
                                                <input type="text" value={item.title.name} onChange={(e) => handleTitleChange(index, 'name', e.target.value)} className="p-1 border border-transparent hover:border-gray-300 focus:border-blue-500 rounded-md bg-transparent w-full" aria-label="Edit Name" />
                                            </div>
                                        </div>
                                        <div className="flex items-center self-end sm:self-center gap-2">
                                            {outputMode === 'template' && excelTemplateFile?.path ? (
                                                <button onClick={() => handleDownloadSingle(item)} className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 flex-shrink-0" aria-label={`${item.title.name}のタイムカードをテンプレートに転記`}>
                                                    <DownloadIcon className="-ml-0.5 mr-2 h-4 w-4" />
                                                    テンプレートに転記
                                                </button>
                                            ) : (
                                                <button onClick={() => handleDownloadSingle(item)} className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 flex-shrink-0" aria-label={`${item.title.name}のタイムカードを新規Excelでダウンロード`}>
                                                    <DownloadIcon className="-ml-0.5 mr-2 h-4 w-4" />
                                                    新規Excelでダウンロード
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                    <DataTable 
                                        cardIndex={index} 
                                        headers={['日付', '曜日', '午前 出勤', '午前 退勤', '', '午後 出勤', '午後 退勤']} // 空白列を追加
                                        data={(item.days || []).map(d => [d.date, d.dayOfWeek || '', d.morningStart || '', d.morningEnd || '', '', d.afternoonStart || '', d.afternoonEnd || ''])} // データにも空白列を追加
                                        errors={item.errors}
                                        onDataChange={handleDataChange} 
                                        onRowCreate={handleRowCreate}
                                        onRowRemove={handleRowRemove}
                                        onColCreate={handleColCreate}
                                        onColRemove={handleColRemove}
                                    />                            </>
                            ) : (
                              <>
                                <div className="flex flex-wrap justify-between items-center gap-2 mb-2">
                                    <div className="flex items-center gap-2 text-xl font-bold text-gray-800 flex-grow mr-4 min-w-[200px]">
                                        <DocumentTextIcon className="h-6 w-6 text-gray-600" />
                                        <span>{item.fileName}</span>
                                    </div>
                                    <button onClick={() => handleDownloadSingle(item)} className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 flex-shrink-0" aria-label={`${item.fileName}をダウンロード`}>
                                        <DownloadIcon className="-ml-0.5 mr-2 h-4 w-4" />
                                        Excelファイルで保存
                                    </button>
                                </div>
                                <TranscriptionView cardIndex={index} content={item.content} onContentChange={handleContentChange} />
                              </>
                            )}
                          </div>
                      );

                      return (
                      <div key={index} className="relative border-t pt-6 first:border-t-0 first:pt-0">
                        <div className="absolute top-6 right-0 z-10 flex flex-col gap-1 pt-1">
                            <button onClick={() => handleMoveCard(index, 'up')} disabled={index === 0} className="p-1.5 rounded-md bg-gray-200 hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed" title="上に移動">
                                <ArrowUpIcon className="w-5 h-5 text-gray-700" />
                            </button>
                            <button onClick={() => handleMoveCard(index, 'down')} disabled={index === processedData.length - 1} className="p-1.5 rounded-md bg-gray-200 hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed" title="下に移動">
                                <ArrowDownIcon className="w-5 h-5 text-gray-700" />
                            </button>
                        </div>
                        {item.sourceImageBase64 ? (
                          <PanelGroup direction="horizontal" className="h-[70vh] border rounded-lg shadow-inner">
                            <Panel defaultSize={50} minSize={20}>
                              <div className="w-full h-full p-2 bg-gray-50 flex flex-col">
                                <div className="flex justify-between items-center mb-1">
                                  <p className="text-sm font-medium text-gray-700 truncate">
                                    読み取り元: 
                                    {item.type === 'transcription' ? item.fileName : `${item.title.name} (${item.title.yearMonth})`}
                                  </p>
                                  <div className="flex items-center gap-1">
                                    <button onClick={() => handleRotateImage(index, 'left')} className="p-1 rounded-full hover:bg-gray-200" title="左に90度回転">
                                      <RotateLeftIcon className="w-4 h-4 text-gray-600" />
                                    </button>
                                    <button onClick={() => handleRotateImage(index, 'right')} className="p-1 rounded-full hover:bg-gray-200" title="右に90度回転">
                                      <RotateRightIcon className="w-4 h-4 text-gray-600" />
                                    </button>
                                  </div>
                                </div>
                                <div className="w-full bg-gray-200 flex-grow min-h-0">
                                  <img 
                                    src={item.sourceImageBase64} 
                                    alt="Source Document" 
                                    className="w-full h-full object-contain transition-transform duration-200"
                                    style={{ transform: `rotate(${item.rotation || 0}deg)`}}
                                  />
                                </div>
                              </div>
                            </Panel>
                            <PanelResizeHandle className="w-2 bg-gray-200 hover:bg-blue-500 active:bg-blue-600 transition-colors" />
                            <Panel defaultSize={50} minSize={30}>
                              {renderSpreadsheet(item, index)}
                            </Panel>
                          </PanelGroup>
                        ) : (
                          renderSpreadsheet(item, index)
                        )}
                      </div>
                      )
                    })}
                  </div>
                </Suspense>
              </div>
            </div>
          )}
        </main>
        
        <footer className="text-center mt-12 py-6 border-t border-gray-200 space-y-4">
          <a href="mailto:imai_f@alcs.co.jp?subject=ALCS%E6%96%87%E6%9B%B8OCR%E3%81%AB%E3%81%A4%E3%81%84%E3%81%A6" className="inline-flex items-center justify-center gap-2 text-sm text-gray-600 hover:text-blue-800 hover:underline">
            <MailIcon className="h-5 w-5" />
            <span>フィードバックや不具合報告はこちら</span>
          </a>
        </footer>
      </div>

      {modalPreview && (
        <div
          className="fixed inset-0 bg-black bg-opacity-80 flex justify-center items-center z-50 p-4"
          onClick={() => setModalPreview(null)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="image-preview-title"
        >
          <div
            className="relative"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="image-preview-title" className="sr-only">
              Image Preview: {modalPreview.name}
            </h2>
            <img
              src={modalPreview.url!}
              alt={`Preview of ${modalPreview.name}`}
              className="block max-w-[90vw] max-h-[90vh] object-contain shadow-lg rounded-lg"
            />
            <button
              onClick={() => setModalPreview(null)}
              className="absolute top-0 right-0 -m-3 p-2 text-white bg-black bg-opacity-50 rounded-full hover:bg-opacity-75 transition-colors"
              aria-label="Close image preview"
            >
              <CloseIcon className="w-6 h-6" />
            </button>
          </div>
        </div>
      )}

      {updateStatus && (
        <React.Suspense fallback={null}>
          <UpdateNotification
            message={updateStatus.message}
            isReady={updateStatus.ready}
            onRestart={() => window.electronAPI?.restartApp()}
          />
        </React.Suspense>
      )}
    </div>
  );
};

export default App;
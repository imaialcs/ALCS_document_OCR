export interface ProcessedTable {
  type: 'table';
  title: {
    yearMonth: string;
    name: string;
  };
  headers: string[];
  data: string[][];
  nameCorrected?: boolean;
  sourceImageBase64?: string;
  rotation?: number;
  errors?: { [key: string]: string };
}

export interface ProcessedText {
  type: 'transcription';
  fileName: string;
  content: string;
  sourceImageBase64?: string;
  rotation?: number;
  errors?: { [key: string]: string };
}

export interface TimecardDay {
  date: string;
  dayOfWeek: string | null;
  morningStart: string | null;
  morningEnd: string | null;
  afternoonStart: string | null;
  afternoonEnd: string | null;
}

export interface ProcessedTimecard {
  type: 'timecard';
  title: {
    yearMonth: string;
    name: string;
  };
  days: TimecardDay[];
  nameCorrected?: boolean;
  sourceImageBase64?: string;
  rotation?: number;
  errors?: { [key: string]: string };
}

export type ProcessedData = ProcessedTable | ProcessedText | ProcessedTimecard;

export interface FilePreview {
  file: File;
  type: 'image' | 'pdf';
  url: string | null;
  name: string;
  isLoading: boolean;
}

export interface SuggestedOperation {
  name: string;
  operation: string;
  params: any;
}

export type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
};
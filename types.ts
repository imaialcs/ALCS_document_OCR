export interface ProcessedTable {
  type: 'table';
  title: {
    yearMonth: string;
    name: string;
  };
  headers: string[];
  data: string[][];
  nameCorrected?: boolean;
}

export interface ProcessedText {
  type: 'transcription';
  fileName: string;
  content: string;
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
}

export type ProcessedData = ProcessedTable | ProcessedText | ProcessedTimecard;

export interface FilePreview {
  file: File;
  type: 'image' | 'pdf';
  url: string | null;
  name: string;
  isLoading: boolean;
}

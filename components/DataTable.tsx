import React, { useRef, useState, useEffect } from 'react';
import { HotTable } from '@handsontable/react-wrapper';
import { registerAllModules } from 'handsontable/registry';
import 'handsontable/styles/handsontable.min.css'; // Base CSS
import 'handsontable/styles/ht-theme-main.min.css'; // Main (light) theme CSS

// Import and register the Japanese language pack
import jaJP from 'handsontable/i18n/languages/ja-JP';
import { registerLanguageDictionary } from 'handsontable/i18n';

registerLanguageDictionary(jaJP);

// Handsontableの全モジュールを登録
registerAllModules();
const DataTable: React.FC<{
  cardIndex: number;
  headers: string[];
  data: string[][];
  errors?: { [key: string]: string };
  onDataChange: (cardIndex: number, rowIndex: number, cellIndex: number, value: string) => void;
  onRowCreate: (cardIndex: number, rowIndex: number, amount: number) => void;
  onRowRemove: (cardIndex: number, rowIndex: number, amount: number) => void;
  onColCreate: (cardIndex: number, colIndex: number, amount: number) => void;
  onColRemove: (cardIndex: number, colIndex: number, amount: number) => void;
}> = ({ cardIndex, headers, data, errors, onDataChange, onRowCreate, onRowRemove, onColCreate, onColRemove }) => {

  const hotTableRef = useRef<HotTable>(null);
  const [hiddenColumns, setHiddenColumns] = useState<number[]>([]);
  const [columnVisibility, setColumnVisibility] = useState<{ [key: string]: boolean }>({});

  // Defensive check to ensure data and headers are always arrays
  const safeData = Array.isArray(data) ? data : [];
  const safeHeaders = Array.isArray(headers) ? headers : [];

  useEffect(() => {
    const initialVisibility = safeHeaders.reduce((acc, header) => {
      acc[header] = true;
      return acc;
    }, {} as { [key: string]: boolean });
    setColumnVisibility(initialVisibility);
  }, [safeHeaders]);

  useEffect(() => {
    const newHiddenColumns = safeHeaders
      .map((header, index) => (columnVisibility[header] === false ? index : -1))
      .filter(index => index !== -1);
    setHiddenColumns(newHiddenColumns);
  }, [columnVisibility, safeHeaders]);

  const handleColumnVisibilityChange = (header: string) => {
    setColumnVisibility(prev => ({ ...prev, [header]: !prev[header] }));
  };

  // Determine if this is a timecard table based on fixed headers
  const isTimecard = safeHeaders.length === 6 &&
                     safeHeaders[0] === '日付' &&
                     safeHeaders[1] === '曜日' &&
                     safeHeaders[2] === '午前 出勤' &&
                     safeHeaders[3] === '午前 退勤' &&
                     safeHeaders[4] === '午後 出勤' &&
                     safeHeaders[5] === '午後 退勤';

  const handleAfterChange = (changes: any, source: string) => {
    if (source === 'loadData') {
      return;
    }
    // changes can be null
    if (changes) {
        changes.forEach(([row, prop, oldValue, newValue]: [number, number, any, any]) => {
            onDataChange(cardIndex, row, prop, newValue);
        });
    }
  };

  const handleAfterCreateRow = (index: number, amount: number) => {
    onRowCreate(cardIndex, index, amount);
  };

  const handleAfterRemoveRow = (index: number, amount: number) => {
    onRowRemove(cardIndex, index, amount);
  };

  const handleAfterCreateCol = (index: number, amount: number) => {
    onColCreate(cardIndex, index, amount);
  };

  const handleAfterRemoveCol = (index: number, amount: number) => {
    onColRemove(cardIndex, index, amount);
  };

  return (
    <div className="hot-container">
      <div className="mb-4 p-2 border rounded-md bg-gray-50">
        <p className="text-sm font-medium text-gray-700 mb-2">表示する列を選択:</p>
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          {safeHeaders.map((header, index) => (
            <div key={index} className="flex items-center">
              <input
                type="checkbox"
                id={`col-toggle-${cardIndex}-${index}`}
                checked={columnVisibility[header] ?? true}
                onChange={() => handleColumnVisibilityChange(header)}
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <label htmlFor={`col-toggle-${cardIndex}-${index}`} className="ml-2 text-sm text-gray-600">
                {header}
              </label>
            </div>
          ))}
        </div>
      </div>
      <HotTable
        ref={hotTableRef}
        data={safeData}
        colHeaders={safeHeaders}
        rowHeaders={true}
        height="auto"
        stretchH="none"
        autoColumnSize={{
          useHeaders: true,
        }}
        hiddenColumns={{
          columns: hiddenColumns,
          indicators: true
        }}
        comments={true}
        cells={(row, col) => {
          const cellProperties: { className?: string; comment?: { value: string } } = {};
          const header = safeHeaders[col];
          if (errors && errors[header]) {
            cellProperties.className = 'ht-validation-error';
            cellProperties.comment = { value: errors[header] };
          }
          return cellProperties;
        }}
        contextMenu={{
          items: {
            row_above: {
              name: '上に行を挿入',
              callback: function() {
                if (hotTableRef.current && hotTableRef.current.hotInstance) {
                  const hot = hotTableRef.current.hotInstance;
                  const selection = hot.getSelectedLast();
                  if (selection) {
                    const [r1, , r2] = selection;
                    const rowIndex = Math.min(r1, r2);
                    const amount = Math.abs(r2 - r1) + 1;
                    onRowCreate(cardIndex, rowIndex, amount);
                  }
                }
              }
            },
            row_below: {
              name: '下に行を挿入',
              callback: function() {
                if (hotTableRef.current && hotTableRef.current.hotInstance) {
                  const hot = hotTableRef.current.hotInstance;
                  const selection = hot.getSelectedLast();
                  if (selection) {
                    const [r1, , r2] = selection;
                    const rowIndex = Math.max(r1, r2) + 1;
                    const amount = Math.abs(r2 - r1) + 1;
                    onRowCreate(cardIndex, rowIndex, amount);
                  }
                }
              }
            },
            remove_row: {
              name: '行を削除',
            },
            hsep1: '---------', // Separator
            ...(isTimecard ? {} : { // Conditional column items
              col_left: {
                name: '左に列を挿入',
                callback: function() {
                  if (hotTableRef.current && hotTableRef.current.hotInstance) {
                    const hot = hotTableRef.current.hotInstance;
                    const selection = hot.getSelectedLast();
                    if (selection) {
                      const [, c1, , c2] = selection;
                      const colIndex = Math.min(c1, c2);
                      const amount = Math.abs(c2 - c1) + 1;
                      onColCreate(cardIndex, colIndex, amount);
                    }
                  }
                }
              },
              col_right: {
                name: '右に列を挿入',
                callback: function() {
                  if (hotTableRef.current && hotTableRef.current.hotInstance) {
                    const hot = hotTableRef.current.hotInstance;
                    const selection = hot.getSelectedLast();
                    if (selection) {
                      const [, c1, , c2] = selection;
                      const colIndex = Math.max(c1, c2) + 1;
                      const amount = Math.abs(c2 - c1) + 1;
                      onColCreate(cardIndex, colIndex, amount);
                    }
                  }
                }
              },
              remove_col: {
                name: '列を削除',
              },
              hsep2: '---------',
            }),
            undo: {
              name: '元に戻す',
            },
            redo: {
              name: 'やり直し',
            },
            hsep3: '---------',
            copy: {
              name: 'コピー',
            },
            cut: {
              name: '切り取り',
            },
            paste: {
              name: '貼り付け',
              callback: async function() {
                if (hotTableRef.current && hotTableRef.current.hotInstance) {
                  try {
                    const text = await navigator.clipboard.readText();
                    const hot = hotTableRef.current.hotInstance;
                    const selection = hot.getSelectedLast();
                    if (selection) {
                      const [r, c] = selection;
                      hot.paste(text, r, c);
                    }
                  } catch (err) {
                    console.error('Failed to paste from clipboard:', err);
                    alert('クリップボードからの貼り付けに失敗しました。ブラウザのセキュリティ設定により、直接アクセスできない場合があります。Ctrl+Vをお試しください。');
                  }
                }
              }
            }
          }
        }}
        language='ja-JP' // Set the language to Japanese
        allowInsertRow={true}
        allowInsertColumn={!isTimecard} // Disable column insert for timecards
        allowRemoveRow={true}
        allowRemoveColumn={!isTimecard} // Disable column remove for timecards
        fillHandle={true}
        manualRowMove={true}
        manualColumnMove={true}
        licenseKey="non-commercial-and-evaluation"
        afterChange={handleAfterChange}
        afterCreateRow={handleAfterCreateRow}
        afterRemoveRow={handleAfterRemoveRow}
        afterCreateCol={handleAfterCreateCol}
        afterRemoveCol={handleAfterRemoveCol}
        theme="light" // Set the theme to light
      />
    </div>
  );
};

export default DataTable;

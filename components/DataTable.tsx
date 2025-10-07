import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import jspreadsheet from 'jspreadsheet-ce';
import 'jspreadsheet-ce/dist/jspreadsheet.css';
import 'jsuites/dist/jsuites.css';

const JSPREADSHEET_JA_DICTIONARY = {
  'No records found': 'データはありません',
  'Showing page {0} of {1} entries': '全{1}件中{0}ページ目を表示',
  'Show ': '表示 ',
  Search: '検索',
  ' entries': ' 件',
  'Column name': '列名',
  'Insert a new column before': '列を左に挿入',
  'Insert a new column after': '列を右に挿入',
  'Delete selected columns': '選択した列を削除',
  'Rename this column': '列名を変更',
  'Order ascending': '昇順で並べ替え',
  'Order descending': '降順で並べ替え',
  'Insert a new row before': '行を上に挿入',
  'Insert a new row after': '行を下に挿入',
  'Delete selected rows': '選択した行を削除',
  'Edit comments': 'コメントを編集',
  'Add comments': 'コメントを追加',
  Comments: 'コメント',
  'Clear comments': 'コメントを削除',
  'Copy...': 'コピー...',
  'Paste...': '貼り付け...',
  'Save as...': '名前を付けて保存...',
  About: 'バージョン情報',
  'Are you sure to delete the selected rows?': '選択した行を削除してもよろしいですか?',
  'Are you sure to delete the selected columns?': '選択した列を削除してもよろしいですか?',
  'This action will destroy any existing merged cells. Are you sure?': 'この操作を実行すると既存の結合セルが解除されます。よろしいですか?',
  'This action will clear your search results. Are you sure?': 'この操作を実行すると検索結果がクリアされます。よろしいですか?',
  'There is a conflict with another merged cell': '他の結合セルと競合しています',
  'Invalid merged properties': '結合セルの設定が不正です',
  'Cell already merged': 'セルは既に結合されています',
  'No cells selected': 'セルが選択されていません',
};

jspreadsheet.setDictionary(JSPREADSHEET_JA_DICTIONARY);

type WorksheetInstance = any;

const COLUMN_PLACEHOLDER = '未設定';
const SELECT_COLUMNS_LABEL = '表示する列を選択';

const TIME_CARD_VARIANTS: string[][] = [
  ['日付', '曜日', '午前 出勤', '午前 退勤', '午後 出勤', '午後 退勤'],
  ['日付', '曜日', '午前 出勤', '午前 退勤', '', '午後 出勤', '午後 退勤'],
];

const columnIndexToName = (index: number): string => {
  let name = '';
  let current = index;

  while (current >= 0) {
    name = String.fromCharCode((current % 26) + 65) + name;
    current = Math.floor(current / 26) - 1;
  }

  return name;
};

const getColumnLabel = (header: string, index: number) => `${columnIndexToName(index)}: ${header || COLUMN_PLACEHOLDER}`;

type DataTableProps = {
  cardIndex: number;
  headers: string[];
  data: string[][];
  errors?: { [key: string]: string };
  onDataChange: (cardIndex: number, rowIndex: number, cellIndex: number, value: string) => void;
  onRowCreate: (cardIndex: number, rowIndex: number, amount: number) => void;
  onRowRemove: (cardIndex: number, rowIndex: number, amount: number) => void;
  onColCreate: (cardIndex: number, colIndex: number, amount: number) => void;
  onColRemove: (cardIndex: number, colIndex: number, amount: number) => void;
  onHeaderRename: (cardIndex: number, colIndex: number, title: string) => void;
};

const DataTable: React.FC<DataTableProps> = ({
  cardIndex,
  headers,
  data,
  errors,
  onDataChange,
  onRowCreate,
  onRowRemove,
  onColCreate,
  onColRemove,
  onHeaderRename,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const worksheetRef = useRef<WorksheetInstance | null>(null);
  const [columnVisibility, setColumnVisibility] = useState<Record<number, boolean>>({});
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [contextMenuPosition, setContextMenuPosition] = useState({ x: 0, y: 0 });
  const [selectedCell, setSelectedCell] = useState<{ x: number, y: number } | null>(null);
  const [renameState, setRenameState] = useState<{ colIndex: number; value: string } | null>(null);
  const closeRenameDialog = useCallback(() => setRenameState(null), []);
  const handleRenameConfirm = useCallback(() => {
    if (!renameState) {
      return;
    }
    onHeaderRename(cardIndex, renameState.colIndex, renameState.value.trim());
    setRenameState(null);
  }, [cardIndex, onHeaderRename, renameState]);

  const safeHeaders = useMemo(() => (Array.isArray(headers) ? headers : []), [headers]);
  const safeData = useMemo(() => (Array.isArray(data) ? data : []), [data]);

  const isTimeCard = useMemo(() => {
    return TIME_CARD_VARIANTS.some((variant) => {
      if (variant.length !== safeHeaders.length) {
        return false;
      }
      return variant.every((label, idx) => safeHeaders[idx] === label);
    });
  }, [safeHeaders]);

  const normalizedData = useMemo(() => {
    return safeData.map((row) => {
      const copy = Array.isArray(row) ? [...row] : [];
      while (copy.length < safeHeaders.length) {
        copy.push('');
      }
      return copy;
    });
  }, [safeData, safeHeaders.length]);

  useEffect(() => {
    setColumnVisibility((prev) => {
      const next: Record<number, boolean> = {};
      safeHeaders.forEach((_, index) => {
        next[index] = prev[index] ?? true;
      });
      return next;
    });
  }, [safeHeaders]);

  const destroyWorksheet = useCallback((targetInstance?: WorksheetInstance | null) => {
    const instance = targetInstance ?? worksheetRef.current;
    if (!instance) {
      return;
    }

    if (typeof instance.destroy === 'function') {
      instance.destroy();
    } else if (containerRef.current && typeof (jspreadsheet as any).destroy === 'function') {
      try {
        (jspreadsheet as any).destroy(containerRef.current);
      } catch {
        // ignore cleanup errors
      }
    }

    if (!targetInstance || instance === worksheetRef.current) {
      worksheetRef.current = null;
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }
    }
  }, []);

  const applyColumnVisibility = useCallback(
    (targetInstance?: WorksheetInstance | null) => {
      const instance = targetInstance ?? worksheetRef.current;
      if (!instance) {
        return;
      }

      if (typeof instance.showColumn !== 'function' || typeof instance.hideColumn !== 'function') {
        return;
      }

      safeHeaders.forEach((_, index) => {
        const visible = columnVisibility[index] ?? true;
        if (visible) {
          instance.showColumn(index);
        } else {
          instance.hideColumn(index);
        }
      });
    },
    [columnVisibility, safeHeaders],
  );

  const applyErrors = useCallback(
    (targetInstance?: WorksheetInstance | null) => {
      const instance = targetInstance ?? worksheetRef.current;
      if (!instance) {
        return;
      }

      if (typeof instance.getHeader !== 'function' || typeof instance.getCellFromCoord !== 'function') {
        return;
      }

      const totalRows = normalizedData.length;
      safeHeaders.forEach((header, colIndex) => {
        const hasError = Boolean(errors && errors[header]);
        const message = errors?.[header] ?? '';

        const headerElement = instance.getHeader(colIndex);
        if (headerElement) {
          headerElement.classList.toggle('jspreadsheet-validation-error', hasError);
          if (hasError) {
            headerElement.setAttribute('title', message);
          } else {
            headerElement.removeAttribute('title');
          }
        }

        for (let rowIndex = 0; rowIndex < totalRows; rowIndex += 1) {
          const cell = instance.getCellFromCoord(colIndex, rowIndex);
          if (cell) {
            cell.classList.toggle('jspreadsheet-validation-error', hasError);
            if (hasError) {
              cell.setAttribute('title', message);
            } else {
              cell.removeAttribute('title');
            }
          }
        }
      });
    },
    [errors, normalizedData.length, safeHeaders],
  );

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return undefined;
    }

    destroyWorksheet();

    container.innerHTML = '';

    const result = jspreadsheet(container, {
      worksheets: [
        {
          data: normalizedData,
          columns: safeHeaders.map((header, index) => ({ title: getColumnLabel(header, index), type: 'text' })),
          allowInsertColumn: !isTimeCard,
          allowDeleteColumn: !isTimeCard,
          allowInsertRow: true,
          allowDeleteRow: true,
          allowRenameColumn: false,
          columnDrag: true,
          columnResize: true,
          selectionCopy: true,
          tableOverflow: true,
          tableWidth: '100%',
          onchange: (_instance: WorksheetInstance, _cell: HTMLElement, x: number, y: number, value: string | number | boolean | null) => {
            onDataChange(cardIndex, y, x, value != null ? String(value) : '');
          },
          oninsertrow: (_instance: WorksheetInstance, rowNumber: number, amount: number) => {
            onRowCreate(cardIndex, rowNumber, amount);
          },
          ondeleterow: (_instance: WorksheetInstance, rowNumber: number, amount: number) => {
            onRowRemove(cardIndex, rowNumber, amount);
          },
          oninsertcolumn: (_instance: WorksheetInstance, columnNumber: number, amount: number) => {
            if (!isTimeCard) {
              onColCreate(cardIndex, columnNumber, amount);
            }
          },
          ondeletecolumn: (_instance: WorksheetInstance, columnNumber: number, amount: number) => {
            if (!isTimeCard) {
              onColRemove(cardIndex, columnNumber, amount);
            }
          },
          // jspreadsheet-ceのoncontextmenuハンドラはカスタムメニュー表示用
          oncontextmenu: (_instance: WorksheetInstance, cell: HTMLElement, x: number, y: number, value: string, e: MouseEvent) => {
            // ここではpreventDefaultは行わない。DOMレベルで抑制する
            setShowContextMenu(true);
            setContextMenuPosition({ x: e.clientX, y: e.clientY });
            setSelectedCell({ x, y });
          },
        },
      ],
      // jspreadsheet-ceのデフォルトコンテキストメニューを無効化
      contextMenu: false,
      // ローカライズはカスタムメニューで対応するため、textオプションは削除
    });

    const instance = Array.isArray(result) ? result[0] : result;

    if (!instance) {
      return undefined;
    }

    worksheetRef.current = instance;

    applyColumnVisibility(instance);
    applyErrors(instance);
    if (typeof instance.showIndex === 'function') {
      instance.showIndex();
    }

    // DOMレベルでcontextmenuイベントを抑制
    const handleContextMenuEvent = (e: MouseEvent) => {
      e.preventDefault();
      // jspreadsheetのoncontextmenuハンドラが既にカスタムメニューを表示しているので、ここでは何もしない
    };
    container.addEventListener('contextmenu', handleContextMenuEvent);

    return () => {
      destroyWorksheet(instance);
      container.removeEventListener('contextmenu', handleContextMenuEvent);
    };
  }, [
    applyColumnVisibility,
    applyErrors,
    cardIndex,
    destroyWorksheet,
    isTimeCard,
    onColCreate,
    onColRemove,
    onDataChange,
    onRowCreate,
    onRowRemove,
    safeHeaders,
    normalizedData,
    setShowContextMenu,
    setContextMenuPosition,
    setSelectedCell,
  ]);

  useEffect(() => {
    const instance = worksheetRef.current;
    if (!instance) {
      return;
    }

    if (typeof instance.getData === 'function' && typeof instance.setData === 'function') {
      const current = instance.getData();
      if (JSON.stringify(current) !== JSON.stringify(normalizedData)) {
        instance.setData(normalizedData);
      }
    }

    applyColumnVisibility(instance);
    applyErrors(instance);
    if (typeof instance.showIndex === 'function') {
      instance.showIndex();
    }
  }, [normalizedData, applyColumnVisibility, applyErrors]);

  const handleColumnVisibilityChange = (index: number) => {
    setColumnVisibility((prev) => ({ ...prev, [index]: !prev[index] }));
  };

  return (
    <div className="hot-container jspreadsheet-container">
      <div className="mb-4 p-2 border rounded-md bg-gray-50">
        <p className="text-sm font-medium text-gray-700 mb-2">{SELECT_COLUMNS_LABEL}</p>
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          {safeHeaders.map((header, index) => (
            <div key={index} className="flex items-center">
              <input
                type="checkbox"
                id={`col-toggle-${cardIndex}-${index}`}
                checked={columnVisibility[index] ?? true}
                onChange={() => handleColumnVisibilityChange(index)}
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <label htmlFor={`col-toggle-${cardIndex}-${index}`} className="ml-2 text-sm text-gray-600">
                {getColumnLabel(header, index)}
              </label>
            </div>
          ))}
        </div>
      </div>
      <div ref={containerRef} className="jspreadsheet-wrapper" />

{showContextMenu && (
  <div
    className="absolute z-50 bg-white border border-gray-300 rounded-md shadow-lg py-1"
    style={{ top: contextMenuPosition.y, left: contextMenuPosition.x }}
    onMouseLeave={() => setShowContextMenu(false)}
  >
    <button
      className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
      onClick={() => {
        if (worksheetRef.current && selectedCell) {
          worksheetRef.current.insertRow(1, selectedCell.y);
          onRowCreate(cardIndex, selectedCell.y, 1);
        }
        setShowContextMenu(false);
      }}
    >
      Insert row above
    </button>
    <button
      className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
      onClick={() => {
        if (worksheetRef.current && selectedCell) {
          worksheetRef.current.insertRow(1, selectedCell.y + 1);
          onRowCreate(cardIndex, selectedCell.y + 1, 1);
        }
        setShowContextMenu(false);
      }}
    >
      Insert row below
    </button>
    <button
      className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
      onClick={() => {
        if (worksheetRef.current && selectedCell) {
          worksheetRef.current.deleteRow(selectedCell.y);
          onRowRemove(cardIndex, selectedCell.y, 1);
        }
        setShowContextMenu(false);
      }}
    >
      Delete row
    </button>
    <div className="border-t border-gray-200 my-1" />
    <button
      className={`block w-full text-left px-4 py-2 text-sm text-gray-700 ${isTimeCard ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-100'}`}
      onClick={() => {
        if (!isTimeCard && worksheetRef.current && selectedCell) {
          worksheetRef.current.insertColumn(1, selectedCell.x);
          onColCreate(cardIndex, selectedCell.x, 1);
        }
        setShowContextMenu(false);
      }}
      disabled={isTimeCard}
    >
      Insert column left
    </button>
    <button
      className={`block w-full text-left px-4 py-2 text-sm text-gray-700 ${isTimeCard ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-100'}`}
      onClick={() => {
        if (!isTimeCard && worksheetRef.current && selectedCell) {
          worksheetRef.current.insertColumn(1, selectedCell.x + 1);
          onColCreate(cardIndex, selectedCell.x + 1, 1);
        }
        setShowContextMenu(false);
      }}
      disabled={isTimeCard}
    >
      Insert column right
    </button>
    <button
      className={`block w-full text-left px-4 py-2 text-sm text-gray-700 ${isTimeCard ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-100'}`}
      onClick={() => {
        if (!isTimeCard && worksheetRef.current && selectedCell) {
          worksheetRef.current.deleteColumn(selectedCell.x);
          onColRemove(cardIndex, selectedCell.x, 1);
        }
        setShowContextMenu(false);
      }}
      disabled={isTimeCard}
    >
      Delete column
    </button>
    <button
      className={`block w-full text-left px-4 py-2 text-sm text-gray-700 ${isTimeCard ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-100'}`}
      onClick={() => {
        if (!isTimeCard && worksheetRef.current && selectedCell) {
          const currentTitle = safeHeaders[selectedCell.x] ?? '';
          setRenameState({ colIndex: selectedCell.x, value: currentTitle });
        }
        setShowContextMenu(false);
      }}
      disabled={isTimeCard}
    >
      Rename column
    </button>
    <div className="border-t border-gray-200 my-1" />
    <button
      className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
      onClick={() => {
        if (worksheetRef.current) {
          worksheetRef.current.copy(true);
        }
        setShowContextMenu(false);
      }}
    >
      Copy
    </button>
    <button
      className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
      onClick={() => {
        if (worksheetRef.current) {
          worksheetRef.current.paste(true);
        }
        setShowContextMenu(false);
      }}
    >
      Paste
    </button>
    <div className="border-t border-gray-200 my-1" />
    <button
      className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
      onClick={() => {
        if (worksheetRef.current) {
          worksheetRef.current.undo();
        }
        setShowContextMenu(false);
      }}
    >
      Undo
    </button>
    <button
      className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
      onClick={() => {
        if (worksheetRef.current) {
          worksheetRef.current.redo();
        }
        setShowContextMenu(false);
      }}
    >
      Redo
    </button>
  </div>
)}

{renameState && (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
    <div className="w-full max-w-sm rounded-lg bg-white p-6 shadow-xl">
      <h3 className="text-lg font-semibold text-gray-800 mb-4">Rename column</h3>
      <input
        type="text"
        value={renameState.value}
        onChange={(event) =>
          setRenameState(prev => (prev ? { ...prev, value: event.target.value } : prev))
        }
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            handleRenameConfirm();
          } else if (event.key === 'Escape') {
            event.preventDefault();
            closeRenameDialog();
          }
        }}
        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
        placeholder="Enter a column name"
        autoFocus
      />
      <div className="mt-4 flex justify-end gap-2">
        <button
          type="button"
          className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-100"
          onClick={closeRenameDialog}
        >
          Cancel
        </button>
        <button
          type="button"
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-1"
          onClick={handleRenameConfirm}
        >
          Save
        </button>
      </div>
    </div>
  </div>
)}

    </div>
  );
};

export default DataTable;

import React from 'react';
import { HotTable } from '@handsontable/react';
import { registerAllModules } from 'handsontable/registry';
import 'handsontable/dist/handsontable.full.css';

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
  onDataChange: (cardIndex: number, rowIndex: number, cellIndex: number, value: string) => void;
  onRowCreate: (cardIndex: number, rowIndex: number, amount: number) => void;
  onRowRemove: (cardIndex: number, rowIndex: number, amount: number) => void;
}> = ({ cardIndex, headers, data, onDataChange, onRowCreate, onRowRemove }) => {

  // Defensive check to ensure data and headers are always arrays
  const safeData = Array.isArray(data) ? data : [];
  const safeHeaders = Array.isArray(headers) ? headers : [];

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

  return (
    <div className="hot-container">
      <HotTable
        data={safeData}
        colHeaders={safeHeaders}
        rowHeaders={true}
        width="auto"
        height="auto"
        stretchH="all"
        contextMenu={true}
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
      />
    </div>
  );
};

export default DataTable;

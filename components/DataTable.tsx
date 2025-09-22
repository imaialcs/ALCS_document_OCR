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
}> = ({ cardIndex, headers, data, onDataChange }) => {

  // Defensive check to ensure data and headers are always arrays
  const safeData = Array.isArray(data) ? data : [];
  const safeHeaders = Array.isArray(headers) ? headers : [];

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
        allowInsertColumn={true}
        allowRemoveRow={true}
        allowRemoveColumn={true}
        fillHandle={true}
        manualRowMove={true}
        manualColumnMove={true}
        licenseKey="non-commercial-and-evaluation"
        afterChange={handleAfterChange}
      />
    </div>
  );
};

export default DataTable;
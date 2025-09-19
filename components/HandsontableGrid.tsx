import React, { useEffect, useRef, useCallback } from 'react';
import { HotTable, HotTableRef } from '@handsontable/react-wrapper';
import Handsontable from 'handsontable';
import { registerAllModules } from 'handsontable/registry';
import 'handsontable/dist/handsontable.full.css';

// register Handsontable's modules
registerAllModules();

interface HandsontableGridProps {
  headers: string[];
  data: string[][];
  onDataChange: (newData: string[][]) => void;
  onSplit: (rowIndex: number) => void;
}

const HandsontableGrid: React.FC<HandsontableGridProps> = ({ headers, data, onDataChange, onSplit }) => {
  const hotTableRef = useRef<HotTableRef>(null);

  useEffect(() => {
    const hot = hotTableRef.current?.hotInstance;
    if (hot && hot.getSourceData() !== data) {
        hot.loadData(data);
    }
  }, [data]);

  const onAfterChange = (changes: Handsontable.CellChange[] | null, source: Handsontable.ChangeSource) => {
    if (source === 'loadData') {
      return; 
    }
    const hot = hotTableRef.current?.hotInstance;
    if (hot) {
      const currentData = hot.getData();
      onDataChange(currentData);
    }
  };

  const getContextMenu = useCallback(() => {
    return {
      items: {
        'row_above': {},
        'row_below': {},
        'col_left': {},
        'col_right': {},
        'remove_row': {},
        'remove_col': {},
        'undo': {},
        'redo': {},
        'cut': {},
        'copy': {},
        'sp1': { name: '---------' },
        'split_table': {
          name: 'この行で表を分割',
          callback: () => {
            const hot = hotTableRef.current?.hotInstance;
            if (!hot) return;
            const selected = hot.getSelected();
            if (selected && selected.length > 0) {
              const startRow = selected[0][0];
              onSplit(startRow);
            }
          },
          disabled: () => {
            const hot = hotTableRef.current?.hotInstance;
            if (!hot) return true;
            const selected = hot.getSelected();
            return !selected || selected.length === 0;
          }
        }
      }
    };
  }, [onSplit]);

  return (
    <div className="handsontable-container">
      <HotTable
        ref={hotTableRef}
        data={data}
        colHeaders={headers}
        rowHeaders={true}
        width="100%"
        height="auto"
        autoWrapRow={true}
        autoWrapCol={true}
        licenseKey="non-commercial-and-evaluation" // For non-commercial use
        contextMenu={getContextMenu()}
        manualRowMove={true}
        manualColumnMove={true}
        manualRowResize={true}
        manualColumnResize={true}
        allowInsertRow={true}
        allowInsertColumn={true}
        allowRemoveRow={true}
        allowRemoveColumn={true}
        multiColumnSorting={true}
        filters={true}
        afterChange={onAfterChange}
        stretchH="all"
      />
    </div>
  );
};

export default HandsontableGrid;

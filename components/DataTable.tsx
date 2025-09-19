import React, { useMemo } from 'react';
import { ScissorsIcon } from './icons';

const DataTable: React.FC<{
  cardIndex: number;
  headers: string[];
  data: string[][];
  onDataChange: (cardIndex: number, rowIndex: number, cellIndex: number, value: string) => void;
  isSplitMode: boolean;
  onSplit: (cardIndex: number, rowIndex: number) => void;
}> = ({ cardIndex, headers, data, onDataChange, isSplitMode, onSplit }) => {
  const columnWidths = useMemo(() => {
    const widths = headers.map(h => h.length);
    (data || []).forEach(row => {
      (row || []).forEach((cell, cellIndex) => {
        const cellLength = (cell || '').length;
        if (cellLength > (widths[cellIndex] || 0)) {
          widths[cellIndex] = cellLength;
        }
      });
    });
    return widths;
  }, [data, headers]);

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full bg-white">
        <thead className="bg-gray-100">
          <tr>
            {headers.map((header, index) => (
              <th key={index} className="px-4 py-2 text-left text-sm font-semibold text-gray-600 uppercase tracking-wider" style={{ minWidth: `${columnWidths[index] * 1.5 + 4}ch` }}>{header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {(data || []).map((row, rowIndex) => (
            <React.Fragment key={rowIndex}>
              {isSplitMode && rowIndex > 0 && (
                <tr className="bg-blue-50 hover:bg-blue-100 border-b">
                  <td colSpan={headers.length} className="py-0 px-0 text-center">
                    <button
                      onClick={() => onSplit(cardIndex, rowIndex)}
                      className="w-full flex items-center justify-center gap-2 text-xs font-medium text-blue-700 py-1"
                    >
                      <ScissorsIcon className="w-4 h-4" />
                      ここで表を分割
                    </button>
                  </td>
                </tr>
              )}
              <tr className="border-b">
                {(row || []).map((cell, cellIndex) => (
                  <td key={cellIndex} className="px-4 py-2">
                    <input
                      type="text"
                      value={cell || ''}
                      onChange={(e) => onDataChange(cardIndex, rowIndex, cellIndex, e.target.value)}
                      className="w-full px-1 py-0.5 border border-transparent focus:outline-none focus:border-blue-500 rounded-sm bg-transparent text-gray-900"
                    />
                  </td>
                ))}
              </tr>
            </React.Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default DataTable;

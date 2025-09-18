import sys
import json
import os
import re
import datetime

try:
    import xlwings as xw
    import pywintypes
    XLWINGS_AVAILABLE = True
except ImportError:
    XLWINGS_AVAILABLE = False

try:
    import openpyxl
    OPENPYXL_AVAILABLE = True
except ImportError:
    OPENPYXL_AVAILABLE = False

def cell_to_row_col(cell_address):
    """Converts an Excel cell address like 'A1' or 'BC23' to (row, col) tuple."""
    match = re.match(r"([A-Z]+)(\d+)", cell_address.upper())
    if not match:
        raise ValueError(f"Invalid cell address format: {cell_address}")
    col_name = match.group(1)
    row_num = int(match.group(2))
    col_num = 0
    for char in col_name:
        col_num = col_num * 26 + (ord(char) - ord('A') + 1)
    return row_num, col_num

def find_sheet_safely(book_sheets, target_sheet_name):
    """Finds a sheet by name, allowing for partial matches."""
    # Exact match first
    for sheet in book_sheets:
        if sheet.name == target_sheet_name:
            return sheet
    # Partial match (contains)
    for sheet in book_sheets:
        if target_sheet_name in sheet.name:
            return sheet
    # Partial match (is contained in)
    for sheet in book_sheets:
        if sheet.name in target_sheet_name:
            return sheet
    return None

def process_with_xlwings(template_path, operations):
    """Processes Excel operations using xlwings."""
    excel_app = xw.App(visible=False)
    wb = None
    try:
        wb = excel_app.books.open(template_path)
        processed_count = 0
        for op in operations:
            sheet_name = op.get("sheet_name")
            data = op.get("data")
            start_cell = op.get("start_cell")

            if not all([sheet_name, data, start_cell]):
                print(f"Warning: Skipping invalid operation: {op}")
                continue

            sheet = find_sheet_safely(wb.sheets, sheet_name)
            if not sheet:
                print(f"Warning: Sheet '{sheet_name}' not found. Skipping operation.")
                continue

            try:
                sheet.api.Unprotect()
            except Exception:
                pass  # Ignore if not protected or fails

            start_row, start_col = cell_to_row_col(start_cell)
            sheet.range((start_row, start_col)).value = data
            processed_count += 1
        
        if processed_count > 0:
            wb.save()
        return {"success": True, "message": f"{processed_count}件の操作をExcelファイルに正常に転記しました。"}
    finally:
        if wb:
            wb.close()
        excel_app.quit()

def process_with_openpyxl(template_path, operations):
    """Processes Excel operations using openpyxl."""
    is_xlsm = template_path.lower().endswith('.xlsm')
    wb = openpyxl.load_workbook(template_path, keep_vba=is_xlsm)
    
    processed_count = 0
    for op in operations:
        sheet_name = op.get("sheet_name")
        data = op.get("data")
        start_cell = op.get("start_cell")

        if not all([sheet_name, data, start_cell]):
            print(f"Warning: Skipping invalid operation: {op}")
            continue

        sheet = find_sheet_safely(wb, sheet_name)
        if not sheet:
            print(f"Warning: Sheet '{sheet_name}' not found. Skipping operation.")
            continue
            
        start_row, start_col = cell_to_row_col(start_cell)
        for i, row_data in enumerate(data):
            for j, cell_value in enumerate(row_data):
                # openpyxl is 1-based, and so is our calculation
                sheet.cell(row=start_row + i, column=start_col + j, value=cell_value)
        processed_count += 1

    if processed_count > 0:
        wb.save(template_path)
    return {"success": True, "message": f"{processed_count}件の操作をExcelファイルに正常に転記しました。"}

def log_error(e, context=""):
    """Logs an error to a file."""
    log_file_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "excel_handler_error.log")
    with open(log_file_path, "a", encoding="utf-8") as log_file:
        import traceback
        log_file.write(f"[{datetime.datetime.now()}] Error {context}: {e}\n")
        log_file.write(traceback.format_exc())
        log_file.write("-" * 50 + "\n")

if __name__ == "__main__":
    json_file_path = ""
    try:
        if len(sys.argv) < 2:
            raise ValueError("No input JSON file path provided.")
        
        json_file_path = sys.argv[1]
        with open(json_file_path, 'r', encoding='utf-8') as f:
            input_data = json.load(f)

        template_path = input_data.get("template_path")
        operations = input_data.get("operations")

        if not template_path or not isinstance(operations, list):
            raise ValueError("'template_path' and a list of 'operations' are required.")

        result = {}
        # Prefer xlwings for its robustness with live Excel instances
        if XLWINGS_AVAILABLE:
            try:
                result = process_with_xlwings(template_path, operations)
            except Exception as e:
                log_error(e, "while running xlwings")
                if OPENPYXL_AVAILABLE:
                    print("Info: xlwings failed. Falling back to openpyxl.")
                    result = process_with_openpyxl(template_path, operations)
                else:
                    raise Exception("xlwings failed and openpyxl is not available.")
        elif OPENPYXL_AVAILABLE:
            result = process_with_openpyxl(template_path, operations)
        else:
            raise Exception("No suitable library (xlwings or openpyxl) found.")

        print(json.dumps(result, ensure_ascii=False))

    except Exception as e:
        log_error(e, "in main execution block")
        print(json.dumps({"success": False, "error": str(e)}, ensure_ascii=False))
        sys.exit(1)
    finally:
        # Clean up the temporary file
        if json_file_path and os.path.exists(json_file_path):
            try:
                os.remove(json_file_path)
            except OSError as e:
                log_error(e, f"while cleaning up temp file {json_file_path}")

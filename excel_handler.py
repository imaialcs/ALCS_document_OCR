import sys
import json
import os
import re
import datetime
import traceback

# Add current directory to sys.path for PyInstaller compatibility
if getattr(sys, 'frozen', False):
    _script_dir = os.path.dirname(sys.executable)
else:
    _script_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.append(_script_dir)

# Define log file path at the very beginning, using the executable's directory for robustness
LOG_FILE_PATH = os.path.join(_script_dir, "excel_handler_error.log")

def log_error(e, context=""):
    try:
        with open(LOG_FILE_PATH, "a", encoding="utf-8") as log_file:
            log_file.write(f"[{datetime.datetime.now()}] Error {context}: {e}\n")
            log_file.write(traceback.format_exc())
            log_file.write("-" * 50 + "\n")
    except Exception as log_e:
        # Fallback to original stderr if logging to file fails
        sys.__stderr__.write(f"[{datetime.datetime.now()}] CRITICAL ERROR: Failed to write to log file: {log_e}\n")
        sys.__stderr__.write(f"Original Error {context}: {e}\n")
        traceback.print_exc(file=sys.__stderr__)
        sys.__stderr__.write("-" * 50 + "\n")

# Set up a global exception handler to catch unhandled exceptions
def global_exception_handler(exc_type, exc_value, exc_traceback):
    log_error(exc_value, f"Unhandled Exception: {exc_type.__name__}")
    sys.__excepthook__(exc_type, exc_value, exc_traceback) # Call default handler

sys.excepthook = global_exception_handler

# Debugging: Log script start and environment info
log_error("Script started (after initial setup).", "DEBUG")
log_error(f"Python version: {sys.version}", "DEBUG")
log_error(f"Current working directory: {os.getcwd()}", "DEBUG")
log_error(f"Script path: {os.path.abspath(__file__)}", "DEBUG")
log_error(f"Log file path: {LOG_FILE_PATH}", "DEBUG")
log_error(f"sys.path: {sys.path}", "DEBUG") # Log sys.path

try:
    import xlwings as xw
    import pywintypes
    XLWINGS_AVAILABLE = True
    log_error("xlwings imported successfully.", "DEBUG")
except ImportError as e:
    log_error(e, "ImportError: xlwings")
    XLWINGS_AVAILABLE = False
except Exception as e:
    log_error(e, "while importing xlwings (general exception)")
    XLWINGS_AVAILABLE = False

try:
    import openpyxl
    OPENPYXL_AVAILABLE = True
    log_error("openpyxl imported successfully.", "DEBUG")
except ImportError as e:
    log_error(e, "ImportError: openpyxl")
    OPENPYXL_AVAILABLE = False
except Exception as e:
    log_error(e, "while importing openpyxl (general exception)")
    OPENPYXL_AVAILABLE = False

def cell_to_row_col(cell_address):
    match = re.match(r"([A-Z]+)(\d+)", cell_address.upper())
    if not match:
        raise ValueError(f"Invalid cell address format: {cell_address}")
    col_name, row_str = match.groups()
    row_num = int(row_str)
    col_num = 0
    for char in col_name:
        col_num = col_num * 26 + (ord(char) - ord('A') + 1)
    return row_num, col_num

def find_sheet_safely(book_or_sheets, target_sheet_name, is_openpyxl=False):
    if is_openpyxl:
        # For openpyxl, book_or_sheets is the workbook object
        # Try exact match first
        if target_sheet_name in book_or_sheets.sheetnames:
            return book_or_sheets[target_sheet_name]
        # Try partial match (contains)
        for sheet_name in book_or_sheets.sheetnames:
            if target_sheet_name in sheet_name:
                return book_or_sheets[sheet_name]
        # Try partial match (is contained in)
        for sheet_name in book_or_sheets.sheetnames:
            if sheet_name in target_sheet_name:
                return book_or_sheets[sheet_name]
        return None
    else:
        # For xlwings, book_or_sheets is wb.sheets collection
        # Exact match first
        for sheet in book_or_sheets:
            if sheet.name == target_sheet_name:
                return sheet
        # Partial match (contains)
        for sheet in book_or_sheets:
            if target_sheet_name in sheet.name:
                return sheet
        # Partial match (is contained in)
        for sheet in book_or_sheets:
            if sheet.name in target_sheet_name:
                return sheet
        return None

def process_with_xlwings(template_path, operations):
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
                continue

            sheet = find_sheet_safely(wb.sheets, sheet_name, is_openpyxl=False)
            if not sheet:
                continue

            try:
                sheet.api.Unprotect()
            except Exception:
                pass

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
    is_xlsm = template_path.lower().endswith('.xlsm')
    wb = None
    try:
        wb = openpyxl.load_workbook(template_path, keep_vba=is_xlsm)
    except Exception as e:
        log_error(e, f"while loading workbook {template_path} with openpyxl")
        raise

    processed_count = 0
    for op in operations:
        sheet_name = op.get("sheet_name")
        data = op.get("data")
        start_cell = op.get("start_cell")

        if not all([sheet_name, data, start_cell]):
            continue

        sheet = find_sheet_safely(wb, sheet_name, is_openpyxl=True)
        if not sheet:
            log_error(f"Sheet '{sheet_name}' not found in workbook.", "sheet not found")
            continue
        
        # openpyxlでシート保護を解除
        if sheet.protection.sheet:
            try:
                sheet.protection.disable()
            except Exception as e:
                log_error(e, f"while disabling sheet protection for {sheet_name} with openpyxl")
                # 保護解除に失敗しても処理を続行
                
        start_row, start_col = cell_to_row_col(start_cell)
        try:
            for i, row_data in enumerate(data):
                for j, cell_value in enumerate(row_data):
                    sheet.cell(row=start_row + i, column=start_col + j, value=cell_value)
            processed_count += 1
        except Exception as e:
            log_error(e, f"while writing data to sheet {sheet_name} at {start_cell} with openpyxl")
            raise

    if processed_count > 0:
        try:
            wb.save(template_path)
        except Exception as e:
            log_error(e, f"while saving workbook {template_path} with openpyxl")
            raise
    return {"success": True, "message": f"{processed_count}件の操作をExcelファイルに正常に転記しました。"}

if __name__ == "__main__":
    json_file_path = ""
    try:
        log_error(f"sys.argv: {sys.argv}", "DEBUG") # Log sys.argv
        if len(sys.argv) < 2:
            raise ValueError("No input JSON file path provided.")
        
        json_file_path = sys.argv[1]
        log_error(f"JSON file path: {json_file_path}", "DEBUG") # Log JSON file path
        
        # Simplified and more robust JSON loading
        with open(json_file_path, 'r', encoding='utf-8') as f:
            input_data = json.load(f)

        template_path = input_data.get("template_path")
        operations = input_data.get("operations")

        if not template_path or not isinstance(operations, list):
            raise ValueError("'template_path' and a list of 'operations' are required.")

        if not os.path.exists(template_path):
            raise FileNotFoundError(f"Template file not found at: {template_path}")

        result = {}
        if XLWINGS_AVAILABLE:
            try:
                result = process_with_xlwings(template_path, operations)
            except Exception as e:
                log_error(e, "while running xlwings")
                if OPENPYXL_AVAILABLE:
                    sys.stderr.write("Info: xlwings failed, falling back to openpyxl.\n")
                    result = process_with_openpyxl(template_path, operations)
                else:
                    raise
        elif OPENPYXL_AVAILABLE:
            result = process_with_openpyxl(template_path, operations)
        else:
            raise Exception("No suitable library (xlwings or openpyxl) found.")

        print(json.dumps(result, ensure_ascii=False))

    except Exception as e:
        log_error(e, "in main execution block")
        log_error(json.dumps({"success": False, "error": str(e)}, ensure_ascii=False), "ERROR_JSON_OUTPUT")
        sys.exit(1)
    finally:
        if json_file_path and os.path.exists(json_file_path):
            try:
                os.remove(json_file_path)
            except OSError as e:
                log_error(e, f"while cleaning up temp file {json_file_path}")

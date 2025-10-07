# ALCS Document OCR

## Introduction
ALCS Document OCR is an OCR application for accounting firms. It reads images of invoices, receipts, bank statements, etc., processes the data, and exports it as an Excel file. It is designed to streamline document management and data entry tasks.

## Features

### 1. OCR Processing for Documents
- **Input Document Types**: Supports PNG, JPG, and PDF files. It can also handle scanned images.
- **Image Quality Improvement**: Applies image quality improvements to enhance OCR accuracy.
- **AI-powered Text Recognition**: Utilizes Google Gemini API for advanced text recognition.

### 2. AI Assistant for Data Extraction and Analysis
- **Data Extraction**: Extracts key information such as dates, amounts, and names, and can identify specific data points for OCR processing.
- **Report Generation**: Generates reports based on OCR results and AI analysis.
- **Natural Language Interaction**: Allows for natural language interaction with the AI assistant to retrieve information and perform tasks.

### 3. Document Processing Workflow
- **Document Input and OCR**: Upload documents and perform OCR to extract text.
- **AI Analysis and Data Extraction**: Use AI to analyze extracted text and extract specific data.
- **Data Export and Output**: Export processed data in various formats.

### 4. Data Verification and Correction
- **AI-assisted Data Correction**: Uses AI to identify and correct OCR errors.
- **Manual Verification and Editing**: Provides an interface for manual verification and editing of extracted data.
- **Error Handling**: Handles errors during OCR and data extraction processes.

### 5. Output and Integration
- **Excel Export**: Exports processed data into Excel files (.xlsx/.xlsm).
- **Data Integration**: Supports integration with other systems by exporting data in a structured format.
- **Output Customization**: Allows customization of output formats and data fields.

## Supported OS
- Windows

## Installation and Usage

1.  Visit the [GitHub Releases](https://github.com/imaialcs/ALCS_document_OCR/releases) page and download the installer (`ALCS-Document-OCR-Setup-X.X.X.exe`).
2.  Run the installer and follow the on-screen instructions to install the application.
3.  Launch the application and start OCR processing.

## Author
- alcs

## Changelog
- v1.2.4 (2025-10-03): Expanded the AI assistant input area to full width, switched the send button to a paper airplane icon, and improved the dev startup script to follow Vite port changes.

- v1.2.5 (2025-10-06): Updated chat alignment for clearer sender separation, added AI typing indicator, and reduced input controls to a more compact default size.

- v1.2.6 (2025-10-07): Fixed a bug where only one timecard was detected per image. Also fixed a critical JSON parsing error that occurred when the AI's response contained extra, non-JSON text.

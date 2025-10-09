# ALCS Document OCR

## 概要
「ALCS Document OCR」は、会計事務所の業務効率化のために開発された、高精度なマルチAI-OCRアプリケーションです。画像やPDF形式の帳票をAIが読み取り、データを処理し、Excelファイルとしてエクスポートします。

## 主な特徴

### 1. 高精度なOCRとデータ抽出
- **多様なファイル形式に対応**: PNG, JPG, PDFなど、様々な形式の画像や帳票ファイルを一度に処理できます。
- **用途に応じた最適化**: 領収書、日計表、銀行通帳といった用途に合わせて、AIが最適なOCR処理を実行します。
- **最新のAIエンジン**: Google Gemini APIを使用し、複雑な帳票からも高精度にデータを抽出します。

### 2. AIアシスタントによる業務支援
- **対話的な指示によるデータ修正**: 「この日付を修正して」、「合計金額を計算して」といった自然言語での指示をAIアシスタントが解釈し、データ修正を提案・実行します。
- **検証とエラーの可視化**: OCR結果の検証を行い、計算が合わない箇所や必須項目が空欄の箇所をハイライト表示します。
- **OpenRouterモデルへの切り替え**: AIアシスタントのモデルをOpenRouterの'deepseek/deepseek-chat-v3.1:free'に変更しました。

### 3. 柔軟なデータ編集機能
- **Excelライクな編集画面**: 読み込んだ画像と抽出結果のデータを同時に表示。直感的な操作で修正・編集が可能です。
- **Handsontableによる編集**: 右クリックメニューから、行の挿入・削除、コピー、貼り付けなどが可能です。

### 4. データ連携と品質管理
- **Excelエクスポート**: 処理結果は、新しいExcelファイル（.xlsx/.xlsm）としてダウンロードできます。
- **テンプレートへのデータ転記**: 既存のExcelテンプレートを選択し、抽出データを指定のセルに転記できます。

## 動作環境
- Windows

## インストールと実行

1.  [GitHubリリースリンク](https://github.com/imaialcs/ALCS_document_OCR/releases)から最新のインストーラー (`ALCS-Document-OCR-Setup-X.X.X.exe`) をダウンロードします。
2.  ダウンロードしたインストーラーを実行し、画面の指示に従ってインストールします。
3.  アプリケーションを起動し、ファイルをドラッグ＆ドロップすることでOCR処理が開始されます。

## 開発環境

### 使用技術スタック

- **フレームワーク**: [Electron](https://www.electronjs.org/), [React](https://reactjs.org/)
- **言語**: [TypeScript](https://www.typescriptlang.org/), [Python](https://www.python.org/)
- **ビルドツール**: [Vite](https://vitejs.dev/)
- **AI**: [Google Gemini API](https://ai.google.dev/), [OpenRouter](https://openrouter.ai/)
- **スタイリング**: [Tailwind CSS](https://tailwindcss.com/)
- **スプレッドシート**: [Handsontable](https://handsontable.com/)

### ビルド手順
```bash
# 依存関係をインストール
npm install

# 開発モードで起動
npm run dev

# アプリケーションをビルド（Windows向け）
npm run dist
```
ビルドされたファイルは`build_output`ディレクトリに格納されます。

## ライセンス

このプロジェクトはMITライセンスの元で公開されています。

## 著者
- alcs

## Changelog
- v1.2.10 (2025-10-08): 安定性向上のためのロールバックと修正。
    - ベースバージョンをv1.2.5に戻し、その後の不安定な変更を破棄しました。
    - AIアシスタントのモデルをOpenRouterの'deepseek/deepseek-chat-v3.1:free'に変更しました。
    - OCR機能のAPIキー参照エラーを修正しました。
    - 開発モードでのExcel転記機能の不具合を修正しました。
    - 起動時のTypeScriptエラーを修正しました。

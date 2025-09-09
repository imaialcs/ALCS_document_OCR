const fs = require('fs');
const path = require('path');

const srcDir = path.resolve(__dirname, '../node_modules/pdfjs-dist/build');
const destDir = path.resolve(__dirname, '../dist/pdfjs');

const workerFileName = 'pdf.worker.mjs';
const srcFile = path.join(srcDir, workerFileName);
const destFile = path.join(destDir, workerFileName);

if (!fs.existsSync(destDir)) {
  fs.mkdirSync(destDir, { recursive: true });
}

if (fs.existsSync(srcFile)) {
  fs.copyFileSync(srcFile, destFile);
  console.log(`Copied ${workerFileName} to ${destDir}`);
} else {
  console.error(`Error: ${workerFileName} not found in ${srcDir}`);
  process.exit(1);
}

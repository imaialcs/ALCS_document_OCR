const { GoogleGenAI } = require('@google/genai');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables from .env file
dotenv.config({ path: path.join(__dirname, '.env') });

const apiKey = process.env.API_KEY;

if (!apiKey) {
  console.error('APIキーが.envファイルに設定されていません。');
  process.exit(1);
}

try {
  const genAI = new GoogleGenAI({ apiKey: apiKey });

  console.log('Type of genAI.getGenerativeModel:', typeof genAI.getGenerativeModel);

  if (typeof genAI.getGenerativeModel === 'function') {
    console.log('SUCCESS: genAI.getGenerativeModel is a function.');
    // You can add more tests here if needed, e.g., try to get a model
    const model = genAI.getGenerativeModel({ model: 'gemini-pro' });
    console.log('Model obtained successfully:', model);
  } else {
    console.error('FAILURE: genAI.getGenerativeModel is NOT a function.');
    console.error('genAI object:', genAI);
  }
} catch (error) {
  console.error('ERROR during GoogleGenAI initialization:', error);
}
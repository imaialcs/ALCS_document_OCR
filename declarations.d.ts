// This file is used to provide ambient type declarations for modules
// that do not have their own type definitions included.

declare module 'xlsx';
declare module 'pdfjs-dist';

declare module '*.svg' {
  const src: string;
  export default src;
}

declare module '*.png' {
  const src: string;
  export default src;
}

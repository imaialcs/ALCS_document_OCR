// Fix: Removed `/// <reference types="vite/client" />` to solve a TypeScript compilation error.
// This is safe as the application does not use Vite-specific client environment variables.

declare module '*?url' {
  const value: string;
  export default value;
}

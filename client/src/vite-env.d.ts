/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_RPC_ENDPOINT: string;
  readonly VITE_ARENA_MINT: string;
  readonly VITE_TREASURY_ADDRESS: string;
  readonly VITE_DEV_WALLET_ADDRESS: string;
  readonly VITE_SERVER_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

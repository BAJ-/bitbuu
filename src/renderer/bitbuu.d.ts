declare global {
  interface Window {
    bitbuu: {
      ping(): Promise<'pong'>;
      saveModel(bytes: Uint8Array): Promise<{ canceled: boolean }>;
      openModel(): Promise<{ canceled: boolean; bytes?: Uint8Array }>;
      confirmQuit(): Promise<'save' | 'discard' | 'cancel'>;
      forceClose(): Promise<void>;
      onCloseRequested(callback: () => void): void;
    };
  }
}

export {};

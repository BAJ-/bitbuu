declare global {
  interface Window {
    bitbuu: {
      platform: NodeJS.Platform;
      saveModel(bytes: Uint8Array): Promise<{ canceled: boolean }>;
      openModel(): Promise<{ canceled: boolean; bytes?: Uint8Array }>;
      confirmDiscard(): Promise<'save' | 'discard' | 'cancel'>;
      forceClose(): Promise<void>;
      onCloseRequested(callback: () => void): void;
    };
  }
}

export {};

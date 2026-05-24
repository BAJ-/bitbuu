declare global {
  interface Window {
    bitbuu: {
      ping(): Promise<'pong'>;
    };
  }
}

export {};

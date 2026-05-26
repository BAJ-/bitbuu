import { contextBridge, ipcRenderer } from 'electron';

export type QuitChoice = 'save' | 'discard' | 'cancel';

const api = Object.freeze({
  ping: (): Promise<'pong'> => ipcRenderer.invoke('ping'),
  saveModel: (bytes: Uint8Array): Promise<{ canceled: boolean }> =>
    ipcRenderer.invoke('model:save', bytes),
  openModel: (): Promise<{ canceled: boolean; bytes?: Uint8Array }> =>
    ipcRenderer.invoke('model:open'),
  confirmQuit: (): Promise<QuitChoice> => ipcRenderer.invoke('app:confirm-quit'),
  forceClose: (): Promise<void> => ipcRenderer.invoke('app:force-close'),
  onCloseRequested: (callback: () => void): void => {
    ipcRenderer.on('app:close-requested', () => callback());
  },
} as const);

export type BitbuuApi = typeof api;

contextBridge.exposeInMainWorld('bitbuu', api);

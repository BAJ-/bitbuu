import { contextBridge, ipcRenderer } from 'electron';

export type DiscardChoice = 'save' | 'discard' | 'cancel';

const api = Object.freeze({
  platform: process.platform,
  ping: (): Promise<'pong'> => ipcRenderer.invoke('ping'),
  saveModel: (bytes: Uint8Array): Promise<{ canceled: boolean }> =>
    ipcRenderer.invoke('model:save', bytes),
  openModel: (): Promise<{ canceled: boolean; bytes?: Uint8Array }> =>
    ipcRenderer.invoke('model:open'),
  confirmDiscard: (): Promise<DiscardChoice> => ipcRenderer.invoke('app:confirm-discard'),
  forceClose: (): Promise<void> => ipcRenderer.invoke('app:force-close'),
  onCloseRequested: (callback: () => void): void => {
    ipcRenderer.removeAllListeners('app:close-requested');
    ipcRenderer.on('app:close-requested', () => callback());
  },
} as const);

export type BitbuuApi = typeof api;

contextBridge.exposeInMainWorld('bitbuu', api);

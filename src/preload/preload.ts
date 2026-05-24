import { contextBridge, ipcRenderer } from 'electron';

const api = Object.freeze({
  ping: (): Promise<'pong'> => ipcRenderer.invoke('ping'),
} as const);

export type BitbuuApi = typeof api;

contextBridge.exposeInMainWorld('bitbuu', api);

import { contextBridge } from 'electron';

contextBridge.exposeInMainWorld('bitbuu', Object.freeze({}));

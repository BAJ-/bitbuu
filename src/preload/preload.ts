import { contextBridge } from 'electron';

// Step 1: expose a versioned namespace with no methods yet.
// Step 2 lands the IPC ping/handshake surface here.
contextBridge.exposeInMainWorld('bitbuu', {
  version: 0,
});

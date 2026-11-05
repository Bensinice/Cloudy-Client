const { contextBridge, ipcRenderer } = require('electron');
const names = ['state','logs','start','stop','restart','files','read','write','check','versions','readVersion','resetFile','defaultDiff','envGet','envSet','settingsGet','settingsSet','chooseFolder','openFolder','openLogs','openUrl','dbTest','dbCreate','mysqlStart','tools','tunnelStart','tunnelStop','backup','backupOpen','exportReport'];
const api = {}; for (const n of names) api[n] = (...a) => ipcRenderer.invoke(n, ...a);
api.on = (ch, f) => { if (ch !== 'log' && ch !== 'state') return; ipcRenderer.on(ch, (_e, d) => f(d)); };
contextBridge.exposeInMainWorld('srv', api);

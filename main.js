const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

function createWindow () {
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js')
    }
  });

  win.loadFile('index.html');
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

ipcMain.handle('open-file-dialog', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [
      { name: 'Markdown ou Texto', extensions: ['md', 'txt'] }
    ]
  });

  if (!canceled && filePaths.length > 0) {
    const filePath = filePaths[0];
    const content = fs.readFileSync(filePath, 'utf-8');
    return { filePath, content };
  }
  return null;
});

ipcMain.handle('open-folder-dialog', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    properties: ['openDirectory']
  });

  if (!canceled && filePaths.length > 0) {
    return filePaths[0];
  }
  return null;
});

function getFileTree(dir) {
  const stats = fs.statSync(dir);
  const info = {
    name: path.basename(dir),
    path: dir,
    isDirectory: stats.isDirectory()
  };

  if (stats.isDirectory()) {
    info.children = fs.readdirSync(dir)
      .map(child => getFileTree(path.join(dir, child)))
      .filter(child => child.isDirectory || child.name.endsWith('.md') || child.name.endsWith('.txt'))
      .sort((a, b) => {
        if (a.isDirectory && !b.isDirectory) return -1;
        if (!a.isDirectory && b.isDirectory) return 1;
        return a.name.localeCompare(b.name);
      });
  }
  return info;
}

ipcMain.handle('read-directory', async (event, dirPath) => {
  try {
    return getFileTree(dirPath);
  } catch (error) {
    console.error(error);
    return null;
  }
});

ipcMain.handle('read-file', async (event, filePath) => {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return content;
  } catch (error) {
    console.error(error);
    return null;
  }
});

ipcMain.handle('save-file', async (event, { filePath, content }) => {
  try {
    if (!filePath) {
      const { canceled, filePath: savePath } = await dialog.showSaveDialog({
        filters: [
          { name: 'Markdown', extensions: ['md'] },
          { name: 'Texto', extensions: ['txt'] }
        ]
      });
      if (canceled || !savePath) return null;
      filePath = savePath;
    }
    fs.writeFileSync(filePath, content, 'utf-8');
    return { filePath, name: path.basename(filePath) };
  } catch (error) {
    console.error(error);
    return null;
  }
});

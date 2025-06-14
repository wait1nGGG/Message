const { app, BrowserWindow } = require('electron')
const path = require('path')

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: true
    }
  })
  
  // 加载本地服务器（如果server.js能提供前端）
  win.loadURL('http://localhost:3000')
  
  // 或者直接加载前端文件（如果不需要后端）
  // win.loadFile('index.html')
}

app.whenReady().then(() => {
  createWindow()
  
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
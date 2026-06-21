const { app, BrowserWindow } = require("electron");

const FRONTEND_URL = process.env.DESKTOP_FRONTEND_URL || "http://localhost:3001";

function createWindow() {
  const win = new BrowserWindow({
    width: 1000,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
    },
  });

  win.loadURL(FRONTEND_URL);
}

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

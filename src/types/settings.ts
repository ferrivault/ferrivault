export interface AppSettings {
  locale: string;
  clipboardClearSeconds: number;
  autoLockMinutes: number;
  closeToTray: boolean;
  showFavicons: boolean;
  activeThemeId: string;
  customThemesJson: string;
  launchAtStartup: boolean;
  startMinimized: boolean;
}

export interface TrayMenuLabels {
  showWindow: string;
  openGenerator: string;
  syncVault: string;
  lockVault: string;
  quit: string;
}

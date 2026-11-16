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

export interface UpdateCheckResult {
  currentVersion: string;
  latestVersion: string;
  updateAvailable: boolean;
  releaseUrl: string;
  releaseName: string;
}

export interface AppSettings {
  locale: string;
  clipboardClearSeconds: number;
  autoLockMinutes: number;
  closeToTray: boolean;
}

export interface TrayMenuLabels {
  showWindow: string;
  openGenerator: string;
  syncVault: string;
  lockVault: string;
  quit: string;
}

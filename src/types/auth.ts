export type ServerRegion = "officialUs" | "officialEu" | "selfHosted";

export interface LoginPayload {
  email: string;
  masterPassword: string;
  region: ServerRegion;
  customServerUrl?: string;
  twoFactorCode?: string;
  newDeviceOtp?: string;
}

export interface AuthStatus {
  isLoggedIn: boolean;
  isLocked: boolean;
  email: string | null;
  serverUrl: string | null;
}

export interface BackendError {
  errorKey: string;
  message: string;
}

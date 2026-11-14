/**
 * Bitwarden Cipher Type:
 * 1 = Login, 2 = Secure Note, 3 = Card, 4 = Identity
 */
export type CipherTypeNumber = 1 | 2 | 3 | 4;

export interface LoginUriView {
  uri: string;
  match?: number | null;
}

export interface LoginView {
  username?: string | null;
  password?: string | null;
  totp?: string | null;
  uris: LoginUriView[];
}

export interface CardView {
  cardholderName?: string | null;
  brand?: string | null;
  number?: string | null;
  expMonth?: string | null;
  expYear?: string | null;
  code?: string | null;
}

export interface IdentityView {
  title?: string | null;
  firstName?: string | null;
  middleName?: string | null;
  lastName?: string | null;
  username?: string | null;
  company?: string | null;
  email?: string | null;
  phone?: string | null;
  ssn?: string | null;
  passportNumber?: string | null;
  licenseNumber?: string | null;
  address1?: string | null;
  address2?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
  country?: string | null;
}

/**
 * Custom Field Type:
 * 0 = Text, 1 = Hidden, 2 = Boolean
 */
export interface CustomFieldView {
  name: string;
  value: string;
  type: number;
}

export interface CipherView {
  id: string;
  organizationId?: string | null;
  folderId?: string | null;
  type: CipherTypeNumber;
  name: string;
  notes?: string | null;
  favorite: boolean;
  login?: LoginView | null;
  card?: CardView | null;
  identity?: IdentityView | null;
  fields: CustomFieldView[];
  revisionDate?: string | null;
  creationDate?: string | null;
  deletedDate?: string | null;
}

export interface FolderView {
  id: string;
  name: string;
  revisionDate?: string | null;
}

export interface OrganizationView {
  id: string;
  name: string;
}

export interface VaultSnapshot {
  email: string;
  serverUrl: string;
  ciphers: CipherView[];
  folders: FolderView[];
  organizations: OrganizationView[];
}

export type VaultScope =
  | { kind: "all" }
  | { kind: "myVault" }
  | { kind: "organization"; organizationId: string };

export function isCipherInVaultScope(
  cipher: CipherView,
  scope: VaultScope
): boolean {
  if (scope.kind === "all") return true;
  if (scope.kind === "myVault") return !cipher.organizationId;
  return cipher.organizationId === scope.organizationId;
}

export interface TotpResponse {
  code: string;
  period: number;
  remainingSeconds: number;
}

export interface PasswordGeneratorOptions {
  length: number;
  uppercase: boolean;
  lowercase: boolean;
  numbers: boolean;
  symbols: boolean;
  minNumbers: number;
  minSymbols: number;
  avoidAmbiguous: boolean;
}

export interface PassphraseGeneratorOptions {
  numWords: number;
  wordSeparator: string;
  capitalize: boolean;
  includeNumber: boolean;
}

export type VaultFilter =
  | { kind: "all" }
  | { kind: "favorites" }
  | { kind: "trash" }
  | { kind: "type"; cipherType: CipherTypeNumber }
  | { kind: "folder"; folderId: string | null };

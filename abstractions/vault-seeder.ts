import { CipherType, UriMatchType } from "../constants";

type CipherTypeAbstraction = (typeof CipherType)[keyof typeof CipherType];

type UriMatchTypeAbstraction = (typeof UriMatchType)[keyof typeof UriMatchType];

type LoginUriTemplate = {
  match: UriMatchTypeAbstraction;
  uri: string;
};

type LoginItemTemplate = {
  uris: LoginUriTemplate[];
  username: string;
  password: string;
  totp: string;
};

type CardItemTemplate = {
  cardholderName: string;
  brand: string;
  number: string;
  expMonth: string;
  expYear: string;
  code: string;
};

type IdentityItemTemplate = {
  title: string;
  firstName: string;
  middleName: string;
  lastName: string;
  address1: string;
  address2: string | null;
  address3: string | null;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  company: string;
  email: string;
  phone: string;
  ssn: string;
  username: string;
  passportNumber: string;
  licenseNumber: string;
};

type FolderTemplate = {
  name: string;
};

type ItemTemplate = {
  organizationId: string | null;
  collectionIds: string[] | null;
  folderId: string | null;
  type: number;
  name: string;
  notes: string;
  favorite: boolean;
  fields?: PageCipherField[];
  login: LoginItemTemplate | null;
  secureNote: null;
  card: CardItemTemplate | null;
  identity: IdentityItemTemplate | null;
  reprompt: 0 | 1;
};

type VaultItem = {
  id: string;
} & ItemTemplate;

type FolderItem = {
  object: string;
  id: string;
} & FolderTemplate;

type PageCipher = {
  cipherType: CipherTypeAbstraction;
  url: string;
  uriMatchType?: UriMatchTypeAbstraction;
  totpSecret?: string;
  fields?: LoginFields & CardFields & IdentityFields;
  additionalLoginUrls?: string[];
};

type LoginFields = {
  username?: PageCipherField;
  password?: PageCipherField;
  totp?: PageCipherField;
};

type CardFields = {
  cardholderName?: PageCipherField;
  brand?: PageCipherField;
  number?: PageCipherField;
  expMonth?: PageCipherField;
  expYear?: PageCipherField;
  code?: PageCipherField;
};

type IdentityFields = {
  title?: PageCipherField;
  firstName?: PageCipherField;
  middleName?: PageCipherField;
  lastName?: PageCipherField;
  address1?: PageCipherField;
  address2?: PageCipherField;
  address3?: PageCipherField;
  city?: PageCipherField;
  state?: PageCipherField;
  postalCode?: PageCipherField;
  country?: PageCipherField;
  company?: PageCipherField;
  email?: PageCipherField;
  phone?: PageCipherField;
  ssn?: PageCipherField;
  passportNumber?: PageCipherField;
  licenseNumber?: PageCipherField;
};

type PageCipherField = {
  /**
   * field selector name, not the field name in the vault
   */
  name?: string;
  value: string;
  type?: number;
};

export {
  CardItemTemplate,
  CipherTypeAbstraction,
  FolderItem,
  FolderTemplate,
  IdentityItemTemplate,
  ItemTemplate,
  LoginItemTemplate,
  LoginUriTemplate,
  PageCipher,
  PageCipherField,
  UriMatchTypeAbstraction,
  VaultItem,
};

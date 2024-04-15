enum CipherType {
  Login = 1,
  SecureNote = 2,
  Card = 3,
  Identity = 4,
}

enum UriMatchType {
  Domain = 0,
  Host = 1,
  StartsWith = 2,
  Exact = 3,
  RegularExpression = 4,
  Never = 5,
}

type LoginUriTemplate = {
  match: UriMatchType;
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
  cipherType: CipherType;
  url: string;
  uriMatchType?: UriMatchType;
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
  CipherType,
  FolderItem,
  FolderTemplate,
  IdentityItemTemplate,
  ItemTemplate,
  LoginItemTemplate,
  LoginUriTemplate,
  PageCipher,
  PageCipherField,
  UriMatchType,
  VaultItem,
};

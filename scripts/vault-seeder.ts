import fetch from "cross-fetch";
import { configDotenv } from "dotenv";
import {
  CardItemTemplate,
  CipherType,
  FolderItem,
  IdentityItemTemplate,
  ItemTemplate,
  LoginItemTemplate,
  PageCipher,
  PageCipherField,
  UriMatchType,
  VaultItem,
} from "../abstractions";
import {
  localPageCiphers,
  publicPageCiphers,
} from "../constants/vault-ciphers";

const PLAYWRIGHT_CIPHERS_FOLDER = "AutofillPlaywrightTestingItems";

configDotenv();

class VaultSeeder {
  constructor() {
    this.runSeeder().then(async () => {
      console.log("Seeding complete, locking vault...");
      await this.lockVault();
    });
  }

  private async runSeeder() {
    console.log("Connected to Vault Management API, unlocking vault...");

    const sessionToken = await this.unlockVault();
    if (!sessionToken) {
      throw new Error("Unable to seed vault, no session token found.");
    }

    const testsFolder = await this.getPlaywrightCiphersFolder(
      PLAYWRIGHT_CIPHERS_FOLDER,
    );

    if (!testsFolder) {
      throw new Error("Unable to seed vault, tests folder not found.");
    }

    await this.seedVault(testsFolder);
  }

  private async seedVault(testsFolder: FolderItem): Promise<void> {
    const existingVaultItems: Record<string, VaultItem> = {};
    const vaultItems = await this.getAllVaultItems(testsFolder.id);
    const isRefreshingVault = Boolean(process.env.REFRESH);

    if (isRefreshingVault) {
      console.log("Refreshing vault and deleting all testing items...");
      for (let index = 0; index < vaultItems.length; index++) {
        const vaultItem = vaultItems[index];
        await this.deleteVaultItem(vaultItem);
        console.log(`${index + 1} / ${vaultItems.length} items deleted...`);
      }
    } else {
      vaultItems.forEach((item) => (existingVaultItems[item.name] = item));
    }

    const allCiphers = [...localPageCiphers, ...publicPageCiphers];

    for (let index = 0; index < allCiphers.length; index++) {
      const pageCipher = allCiphers[index];
      const newVaultItemName = `${index} ${pageCipher.url}`;
      const existingVaultItem = existingVaultItems[newVaultItemName];

      if (existingVaultItem) {
        await this.updateVaultItem(existingVaultItem, pageCipher);
        continue;
      }

      await this.createVaultItem(pageCipher, newVaultItemName, testsFolder.id);
    }
  }

  private async createVaultItem(
    pageCipher: PageCipher,
    vaultItemName: string,
    folderId: string,
  ): Promise<void> {
    const itemData: ItemTemplate = {
      organizationId: null,
      collectionIds: null,
      folderId,
      type: pageCipher.cipherType,
      name: vaultItemName,
      notes: "",
      favorite: false,
      fields: this.generateCustomFieldsLoginItemData(pageCipher),
      login: this.generateLoginItemData(pageCipher),
      secureNote: null,
      card: this.generateCardItemData(pageCipher),
      identity: this.generateIdentityItemData(pageCipher),
      reprompt: 0,
    };

    const { success, message } = await this.queryApi(
      `/object/item`,
      "POST",
      itemData,
    );
    if (!success) {
      console.error(
        `ERROR: Unable to create login item for ${pageCipher.url}, ${message}`,
      );
      return;
    }

    console.log(`Created vault item for ${pageCipher.url}...`);
  }

  private async updateVaultItem(
    existingVaultItem: VaultItem,
    pageCipher: PageCipher,
  ): Promise<void> {
    let itemData: ItemTemplate = existingVaultItem;
    if (pageCipher.cipherType === CipherType.Login) {
      itemData.login = this.generateLoginItemData(pageCipher);
      itemData.fields = this.generateCustomFieldsLoginItemData(pageCipher);
    }

    if (pageCipher.cipherType === CipherType.Card) {
      itemData.card = this.generateCardItemData(pageCipher);
    }

    if (pageCipher.cipherType === CipherType.Identity) {
      itemData.identity = this.generateIdentityItemData(pageCipher);
    }

    const { success, message } = await this.queryApi(
      `/object/item/${existingVaultItem.id}`,
      "PUT",
      itemData,
    );
    if (!success) {
      console.error(
        `ERROR: Unable to update login item for ${pageCipher.url}, ${message}`,
      );
      return;
    }

    console.log(`Updated vault item for ${pageCipher.url}...`);
  }

  private async deleteVaultItem(vaultItem: VaultItem): Promise<void> {
    const { success, message } = await this.queryApi(
      `/object/item/${vaultItem.id}`,
      "DELETE",
    );
    if (!success) {
      console.error(
        `ERROR: Unable to delete login item ${vaultItem.name}, ${message}`,
      );
      return;
    }
  }

  private generateCustomFieldsLoginItemData(
    pageCipher: PageCipher,
  ): PageCipherField[] | undefined {
    if (pageCipher.cipherType !== CipherType.Login) {
      return;
    }

    const fields = pageCipher?.fields || {};
    const inputKeys = Object.keys(fields).filter(
      (keyName) => !["username", "password"].includes(keyName),
    );

    return (inputKeys as string[]).map((keyName) => {
      const field = pageCipher.fields?.[keyName as keyof typeof fields];

      return {
        name: field?.name || "",
        value: field?.value || "",
        type: 1,
      };
    });
  }

  private generateLoginItemData(
    testPage: PageCipher,
  ): LoginItemTemplate | null {
    if (testPage.cipherType !== CipherType.Login) {
      return null;
    }

    let uris = [
      {
        match: testPage.uriMatchType || UriMatchType.Domain,
        uri: testPage.url,
      },
    ];

    testPage.additionalLoginUrls?.forEach((url) =>
      uris.push({
        match: testPage.uriMatchType || UriMatchType.Domain,
        uri: url,
      }),
    );

    const { username, password } = testPage.fields || {};

    return {
      uris,
      username: username?.value || "",
      password: password?.value || "",
      totp: testPage.totpSecret || "",
    };
  }

  private generateCardItemData(testPage: PageCipher): CardItemTemplate | null {
    if (testPage.cipherType !== CipherType.Card) {
      return null;
    }

    const { cardholderName, brand, number, expMonth, expYear, code } =
      testPage.fields || {};
    return {
      cardholderName: cardholderName?.value || "",
      brand: brand?.value || "",
      number: number?.value || "",
      expMonth: expMonth?.value || "",
      expYear: expYear?.value || "",
      code: code?.value || "",
    };
  }

  private generateIdentityItemData(
    testPage: PageCipher,
  ): IdentityItemTemplate | null {
    if (testPage.cipherType !== CipherType.Identity) {
      return null;
    }

    const {
      title,
      firstName,
      middleName,
      lastName,
      address1,
      address2,
      address3,
      city,
      state,
      postalCode,
      country,
      company,
      email,
      phone,
      ssn,
      username,
      passportNumber,
      licenseNumber,
    } = testPage.fields || {};

    return {
      title: title?.value || "",
      firstName: firstName?.value || "",
      middleName: middleName?.value || "",
      lastName: lastName?.value || "",
      address1: address1?.value || "",
      address2: address2?.value || "",
      address3: address3?.value || "",
      city: city?.value || "",
      state: state?.value || "",
      postalCode: postalCode?.value || "",
      country: country?.value || "",
      company: company?.value || "",
      email: email?.value || "",
      phone: phone?.value || "",
      ssn: ssn?.value || "",
      username: username?.value || "",
      passportNumber: passportNumber?.value || "",
      licenseNumber: licenseNumber?.value || "",
    };
  }

  private async unlockVault(): Promise<string> {
    const { success, data, message } = await this.queryApi(`/unlock`, "POST", {
      password: process.env.VAULT_PASSWORD,
    });
    if (!success) {
      throw new Error(`Unable to unlock vault, ${message}`);
    }

    console.log("Vault unlocked...");
    return data?.raw;
  }

  private async lockVault(): Promise<void> {
    const { success, data, message } = await this.queryApi(`/lock`, "POST");
    if (!success) {
      throw new Error(`Unable to lock vault, ${message}`);
    }
  }

  private async getPlaywrightCiphersFolder(
    folderName: string,
  ): Promise<FolderItem | undefined> {
    const { success, data, message } = await this.queryApi(
      `/object/folder/${folderName}`,
    );

    if (success) {
      return data;
    }

    if (message === "Not found.") {
      console.log(
        "Playwright testing items folder not found, creating folder...",
      );
      return await this.createPlaywrightCiphersFolder(folderName);
    }
  }

  private async createPlaywrightCiphersFolder(
    folderName: string,
  ): Promise<FolderItem | undefined> {
    const { success, data, message } = await this.queryApi(
      `/object/folder`,
      "POST",
      { name: folderName },
    );

    if (!success) {
      console.error(`ERROR: Unable to create folder ${folderName}, ${message}`);
      return;
    }

    return data;
  }

  private async getAllVaultItems(folderId: string): Promise<VaultItem[]> {
    const { success, data, message } = await this.queryApi(
      `/list/object/items?folderid=${folderId}`,
    );
    if (!success) {
      throw new Error(
        `ERROR: Unable to get vault items for folder ${folderId}, ${message}`,
      );
    }

    return data.data;
  }

  private async queryApi(
    route: string,
    method: "GET" | "POST" | "PUT" | "DELETE" = "GET",
    body?: any,
  ): Promise<{ success: boolean; data?: any; message?: string }> {
    try {
      const response = await fetch(
        `http://${process.env.CLI_SERVE_HOST}:${process.env.CLI_SERVE_PORT}${route}`,
        {
          method,
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        },
      );

      return await response.json();
    } catch (error) {
      console.error(error);
    }

    return { success: false, message: "Error encountered during fetch" };
  }
}

new VaultSeeder();

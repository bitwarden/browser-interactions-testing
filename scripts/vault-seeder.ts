import fetch from "cross-fetch";
import { configDotenv } from "dotenv";
import {
  AutofillTestPage,
  CardItemTemplate,
  CipherType,
  FieldTemplate,
  FillProperties,
  FolderItem,
  IdentityItemTemplate,
  ItemTemplate,
  LoginItemTemplate,
  UriMatchType,
  VaultItem,
} from "../abstractions";
import {
  testPages,
  knownFailureCases,
} from "../tests/constants/autofill-forms";

const PLAYWRIGHT_CIPHERS_FOLDER = "AutofillPlaywrightTestingItems";

configDotenv();

class VaultSeeder {
  private readonly apiDebounce = 275;

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

    // Include known failure cases in vault seeding for test debugging
    const allTestCases = [...testPages, ...knownFailureCases];

    for (let index = 0; index < allTestCases.length; index++) {
      const testPage = allTestCases[index];
      const testPageItemName = `${index} ${testPage.url}`;
      const existingItem = existingVaultItems[testPageItemName];

      if (existingItem) {
        await this.updateVaultItem(existingItem, testPage);
        continue;
      }

      await this.createVaultItem(testPage, testPageItemName, testsFolder.id);
    }
  }

  private async createVaultItem(
    testPage: AutofillTestPage,
    itemName: string,
    folderId: string,
  ): Promise<void> {
    const itemData: ItemTemplate = {
      organizationId: null,
      collectionIds: null,
      folderId,
      type: testPage.cipherType,
      name: itemName,
      notes: "",
      favorite: false,
      fields: this.generateCustomFieldsLoginItemData(testPage),
      login: this.generateLoginItemData(testPage),
      secureNote: null,
      card: this.generateCardItemData(testPage),
      identity: this.generateIdentityItemData(testPage),
      reprompt: 0,
    };

    const { success, message } = await this.queryApi(
      `/object/item`,
      "POST",
      itemData,
    );
    if (!success) {
      console.error(
        `ERROR: Unable to create login item for ${testPage.url}, ${message}`,
      );
      return;
    }

    console.log(`Created vault item for ${testPage.url}...`);
  }

  private async updateVaultItem(
    existingItem: VaultItem,
    testPage: AutofillTestPage,
  ): Promise<void> {
    if (!this.isVaultItemModified(existingItem, testPage)) {
      console.log(`Skipping ${testPage.url}, no changes detected...`);
      return;
    }

    let itemData: ItemTemplate = existingItem;
    if (testPage.cipherType === CipherType.Login) {
      itemData.login = this.generateLoginItemData(testPage);
      itemData.fields = this.generateCustomFieldsLoginItemData(testPage);
    }

    if (testPage.cipherType === CipherType.Card) {
      itemData.card = this.generateCardItemData(testPage);
    }

    if (testPage.cipherType === CipherType.Identity) {
      itemData.identity = this.generateIdentityItemData(testPage);
    }

    const { success, message } = await this.queryApi(
      `/object/item/${existingItem.id}`,
      "PUT",
      itemData,
    );
    if (!success) {
      console.error(
        `ERROR: Unable to update login item for ${testPage.url}, ${message}`,
      );
      return;
    }

    console.log(`Updated vault item for ${testPage.url}...`);
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

  private isVaultItemModified(
    vaultItem: ItemTemplate,
    testPage: AutofillTestPage,
  ): boolean {
    let comparedValues: [FillProperties | undefined, any][] = [];
    const isValueModified = (
      testItem?: FillProperties,
      vaultValue?: any,
    ): boolean => {
      const testValue = testItem?.value;
      return Boolean(testValue) && testValue !== vaultValue;
    };
    const inputData = testPage.inputs;
    const vaultLogin = vaultItem.login;
    if (testPage.cipherType === CipherType.Login && vaultLogin) {
      comparedValues = [
        [inputData.username, vaultLogin.username],
        [inputData.password, vaultLogin.password],
        [inputData.totp, vaultLogin.totp],
      ];
    }

    const vaultCard = vaultItem.card;
    if (testPage.cipherType === CipherType.Card && vaultCard) {
      comparedValues = [
        [inputData.cardholderName, vaultCard.cardholderName],
        [inputData.brand, vaultCard.brand],
        [inputData.number, vaultCard.number],
        [inputData.expMonth, vaultCard.expMonth],
        [inputData.expYear, vaultCard.expYear],
        [inputData.code, vaultCard.code],
      ];
    }

    const vaultIdentity = vaultItem.identity;
    if (testPage.cipherType === CipherType.Identity && vaultIdentity) {
      comparedValues = [
        [inputData.title, vaultIdentity.title],
        [inputData.firstName, vaultIdentity.firstName],
        [inputData.middleName, vaultIdentity.middleName],
        [inputData.lastName, vaultIdentity.lastName],
        [inputData.address1, vaultIdentity.address1],
        [inputData.address2, vaultIdentity.address2],
        [inputData.address3, vaultIdentity.address3],
        [inputData.city, vaultIdentity.city],
        [inputData.state, vaultIdentity.state],
        [inputData.postalCode, vaultIdentity.postalCode],
        [inputData.country, vaultIdentity.country],
        [inputData.company, vaultIdentity.company],
        [inputData.email, vaultIdentity.email],
        [inputData.phone, vaultIdentity.phone],
        [inputData.ssn, vaultIdentity.ssn],
        [inputData.username, vaultIdentity.username],
        [inputData.passportNumber, vaultIdentity.passportNumber],
        [inputData.licenseNumber, vaultIdentity.licenseNumber],
      ];
    }

    for (const [testItem, vaultValue] of comparedValues) {
      if (isValueModified(testItem, vaultValue)) {
        return true;
      }
    }

    return false;
  }

  private generateCustomFieldsLoginItemData(
    testPage: AutofillTestPage,
  ): FieldTemplate[] {
    if (testPage.cipherType !== CipherType.Login) {
      return [];
    }

    const inputKeys = Object.keys(testPage.inputs).filter(
      (keyName) => !["username", "password", "totp"].includes(keyName),
    );

    return inputKeys.map((keyName: string) => {
      const input =
        testPage.inputs[keyName as keyof AutofillTestPage["inputs"]];

      return {
        name: (input?.selector as string).replace(/#/g, "") || "",
        value: input?.value || "",
        type: 1,
      };
    });
  }

  private generateLoginItemData(
    testPage: AutofillTestPage,
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

    const { username, password, totp } = testPage.inputs;

    return {
      uris,
      username: username?.value || "",
      password: password?.value || "",
      totp: totp?.value || "",
    };
  }

  private generateCardItemData(
    testPage: AutofillTestPage,
  ): CardItemTemplate | null {
    if (testPage.cipherType !== CipherType.Card) {
      return null;
    }

    const { cardholderName, brand, number, expMonth, expYear, code } =
      testPage.inputs;
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
    testPage: AutofillTestPage,
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
    } = testPage.inputs;
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

  private sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

new VaultSeeder();

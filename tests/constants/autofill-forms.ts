import { CipherType, UriMatchType, TestPage } from "../../abstractions";
import { testSiteHost } from "./server";

const testUserName = "bwplaywright";
const testEmail = "bwplaywright@example.com";

/*
Some websites "prequalify" an entered email to see if they have an associated account.
If they don't, they may disallow password entry or force account create workflow, so it is
important that `testUserEmail` is a real address with organizational control.
*/
const testUserEmail = "bwplaywright@gmail.com";

export const testPages: TestPage[] = [
  /**
   * Local webpages
   */
  {
    cipherType: CipherType.Login,
    url: `${testSiteHost}/forms/login/simple`,
    uriMatchType: UriMatchType.StartsWith,
    inputs: {
      username: { selector: "#username", value: testUserName },
      password: { selector: "#password", value: "fakeBasicFormPassword" },
    },
  },
  {
    cipherType: CipherType.Login,
    url: `${testSiteHost}/forms/login/iframe-login`,
    uriMatchType: UriMatchType.StartsWith,
    inputs: {
      username: {
        preFillActions: async (page) => {
          // Accept the iframe fill prompt
          await page.on("dialog", (dialog) => dialog.accept());
        },
        selector: async (page) =>
          await page.frameLocator("#test-iframe").locator("#username"),
        value: testUserName,
      },
      password: {
        selector: async (page) =>
          await page.frameLocator("#test-iframe").locator("#password"),
        value: "fakeIframeBasicFormPassword",
      },
    },
  },
  {
    cipherType: CipherType.Login,
    url: `${testSiteHost}/forms/login/iframe-sandboxed-login`,
    uriMatchType: UriMatchType.StartsWith,
    inputs: {
      username: {
        preFillActions: async (page) => {
          // Accept the iframe fill prompt
          await page.on("dialog", (dialog) => dialog.accept());
        },
        shouldNotFill: true,
        selector: async (page) =>
          await page.frameLocator("#test-iframe").locator("#username"),
        value: testUserName,
      },
      password: {
        shouldNotFill: true,
        selector: async (page) =>
          await page.frameLocator("#test-iframe").locator("#password"),
        value: "fakeSandboxedIframeBasicFormPassword",
      },
    },
  },
  {
    cipherType: CipherType.Login,
    url: `${testSiteHost}/forms/login/multi-step-login`,
    uriMatchType: UriMatchType.StartsWith,
    inputs: {
      username: {
        multiStepNextInputKey: "email",
        selector: "#username",
        value: testUserName,
      },
      email: {
        multiStepNextInputKey: "password",
        selector: "#email",
        value: testEmail,
      },
      password: { selector: "#password", value: "fakeMultiStepPassword" },
    },
  },
  {
    cipherType: CipherType.Login,
    url: `${testSiteHost}/forms/login/bare-inputs-login`,
    uriMatchType: UriMatchType.StartsWith,
    inputs: {
      username: { selector: "#username", value: testUserName },
      password: { selector: "#password", value: "fakeBareInputsPassword" },
    },
  },
  {
    cipherType: CipherType.Login,
    url: `${testSiteHost}/forms/login/input-constraints-login`,
    uriMatchType: UriMatchType.StartsWith,
    inputs: {
      username: { selector: "#email", value: testEmail },
      password: {
        selector: "#password",
        value: "fakeInputConstraintsPassword",
      },
    },
  },
  {
    cipherType: CipherType.Login,
    url: `${testSiteHost}/forms/login/shadow-root-inputs`,
    uriMatchType: UriMatchType.StartsWith,
    inputs: {
      username: {
        selector: async (page) => await page.getByLabel("Username"),
        value: testUserName,
      },
      password: {
        selector: async (page) => await page.getByLabel("Password"),
        value: "fakeShadowRootInputsPassword",
      },
    },
  },
  {
    cipherType: CipherType.Login,
    url: `${testSiteHost}/forms/search/simple-search`,
    uriMatchType: UriMatchType.StartsWith,
    inputs: {
      username: {
        shouldNotFill: true,
        selector: "#search",
        value: testUserName,
      },
      password: {
        shouldNotFill: true,
        selector: "#search",
        value: "fakeSearchPassword",
      },
    },
  },

  // Card and Identity Ciphers currently cannot be autofilled through the same mechanism that Login Ciphers are. This is because of how we handle messaging the background for autofilling login items. The extension will need to be updated to handle these types of Ciphers.
  {
    cipherType: CipherType.Card,
    url: `${testSiteHost}/forms/payment/card-payment`,
    uriMatchType: UriMatchType.StartsWith,
    inputs: {
      cardholderName: { selector: "#card-name", value: "John Smith" },
      // @TODO handle cases where there is no input for card brand/type
      brand: { selector: "#card-number", value: "Visa" },
      number: { selector: "#card-number", value: "4111111111111111" },
      // @TODO handle inputs that enforce different and/or concatenated date formats
      expMonth: { selector: "#card-expiration", value: "12" },
      expYear: { selector: "#card-expiration", value: "2025" },
      code: { selector: "#card-cvv", value: "123" },
    },
  },
  {
    cipherType: CipherType.Identity,
    url: `${testSiteHost}/forms/identity/address-na`,
    uriMatchType: UriMatchType.StartsWith,
    inputs: {
      // @TODO handle cases where there is a single name input (e.g. "full name")
      firstName: { selector: "#full-name", value: "John" },
      middleName: { selector: "#full-name", value: "M" },
      lastName: { selector: "#full-name", value: "Smith" },
      address1: { selector: "#address", value: "123 Main St" },
      address2: { selector: "#address-ext", value: "Apt 1" },
      city: { selector: "#city", value: "New York" },
      state: { selector: "#state", value: "NY" },
      postalCode: { selector: "#postcode", value: "10001" },
      country: { selector: "#country", value: "USA" },
    },
  },

  /**
   * Live websites
   */
  // @TODO In non-debug mode, LinkedIn is often hanging on page load
  // LinkedIn periodically redirects to https://www.linkedin.com/authwall...
  {
    cipherType: CipherType.Login,
    url: "https://www.linkedin.com/",
    additionalLoginUrls: ["https://www.linkedin.com/?original_referer="],
    uriMatchType: UriMatchType.Exact,
    inputs: {
      username: {
        selector: "#session_key",
        value: testUserEmail,
      },
      password: {
        selector: "#session_password",
        value: "fakeLinkedInHomepageLoginPassword",
      },
    },
  },
  {
    cipherType: CipherType.Login,
    url: "https://www.linkedin.com/login",
    uriMatchType: UriMatchType.Exact,
    inputs: {
      username: {
        selector: "#username",
        value: testUserEmail,
      },
      password: {
        selector: "#password",
        value: "fakeLinkedInPassword",
      },
    },
  },
  // Samsung has aggressive automation-blocking, captcha step after email entry
  // Samsung also will periodically not load the login page
  {
    cipherType: CipherType.Login,
    url: "https://account.samsung.com/membership/auth/sign-in",
    inputs: {
      username: {
        // multiStepNextInputKey: "password",
        selector: "#iptLgnPlnID",
        value: testUserEmail,
      },
    },
  },
  // Zillow has a bot/detection "press & hold" test that pariodically triggers
  {
    cipherType: CipherType.Login,
    url: "https://www.zillow.com",
    inputs: {
      username: {
        preFillActions: async (page) => {
          // Open the login options modal
          await page
            .locator(
              "header nav .znav-links ul[data-zg-section='reg-login'] a[href^='/user/acct/login/?cid=pf']"
            )
            .click();
        },
        selector: "#reg-login-email",
        value: testUserEmail,
      },
      password: {
        selector: "#inputs-password",
        value: "fakeZillowPassword",
      },
    },
  },
  {
    cipherType: CipherType.Login,
    url: "https://beta.character.ai/",
    additionalLoginUrls: ["https://character-ai.us.auth0.com"],
    uriMatchType: UriMatchType.Host,
    inputs: {
      username: {
        preFillActions: async (page) => {
          // If there is a queue to access the site, use an alternate path to get to the login page
          const siteQueue = await page
            .locator("main .content-container")
            .filter({ hasText: "You are now in line." });
          const siteIsQueuing = await siteQueue.isVisible();

          if (siteIsQueuing) {
            await page
              .locator("a div")
              .filter({ hasText: "Click here to skip the line!" })
              .click();
            await page
              .locator("button")
              .filter({ hasText: "Login to Subscribe!" })
              .click();
          } else {
            // Close the pop-up prompting you to use the mobile app
            await page.locator("#mobile-app-modal-close").click();
            // Accept the cookie policy
            await page
              .locator("button")
              .filter({ hasText: "Accept" })
              .first()
              .click();
            // Go to the login page (cannot go directly to the login page)
            await page
              .locator("button")
              .filter({ hasText: "Log In" })
              .first()
              .click();
          }
        },
        selector: "#username",
        value: testUserEmail,
      },
      password: {
        selector: "#password",
        value: "fakeCharacterAIPassword",
      },
    },
  },
  // Indeed is sometimes requiring captchas to make it to the first (email) and/or second (password) screen
  {
    cipherType: CipherType.Login,
    url: "https://secure.indeed.com/auth",
    inputs: {
      username: {
        // multiStepNextInputKey: "password",
        selector: "input[type='email']",
        value: testUserEmail,
      },
      // password: {
      //   preFillActions: async (page) =>
      //     await page.locator("#auth-page-google-password-fallback").click(),
      //   selector: "input[name='__password']",
      //   value: "fakeIndeedPassword",
      // },
    },
  },
  // Home Depot's login requires an intermediate step of selecting a login with password option after entering an email
  // Additionally, the email login sometimes fails on the first step (presumably due to automation detection)
  {
    cipherType: CipherType.Login,
    url: "https://www.homedepot.com/auth/view/signin",
    inputs: {
      username: {
        multiStepNextInputKey: "password",
        selector: "#username",
        value: testUserEmail,
      },
      password: {
        preFillActions: async (page) => {
          const dismissButton = await page
            .locator("button.u__default-link")
            .filter({ hasText: "No Thanks" });
          await dismissButton?.click();
        },
        selector: "input#password-input-field",
        value: "fakeHomeDepotPassword",
      },
    },
  },
  // dailymail sometimes stalls waiting for the page load event
  // Note: dailymail also fires a notification permissions request. If you accept, it automatically downloads an executable called `MailOnlineSetup.exe`.
  {
    cipherType: CipherType.Login,
    url: "https://www.dailymail.co.uk/registration/login.html",
    inputs: {
      username: {
        selector: "input[name='j_username']",
        value: testUserEmail,
      },
      password: {
        selector: "input[name='j_password']",
        value: "fakeDailyMailPassword",
      },
    },
  },
  {
    cipherType: CipherType.Login,
    url: "https://accounts.google.com",
    inputs: {
      username: {
        multiStepNextInputKey: "password",
        selector: "input[type='email']",
        value: testUserEmail,
      },
      password: {
        selector: "input[type='password']",
        value: "fakeGooglePassword",
      },
    },
  },
  {
    cipherType: CipherType.Login,
    url: "https://www.facebook.com",
    inputs: {
      username: {
        selector: "#email",
        value: testUserEmail,
      },
      password: {
        selector: "#pass",
        value: "fakeFacebookPassword",
      },
    },
  },
  {
    cipherType: CipherType.Login,
    url: "https://www.reddit.com/login",
    inputs: {
      username: {
        selector: "#loginUsername",
        value: testUserName,
      },
      password: {
        selector: "#loginPassword",
        value: "fakeRedditLoginPagePassword",
      },
    },
  },
  // Amazon sometimes adds an intermediate captcha step, skip testing password fill
  {
    cipherType: CipherType.Login,
    url: "https://www.amazon.com/gp/sign-in.html",
    inputs: {
      username: {
        // multiStepNextInputKey: "password",
        selector: "#ap_email",
        value: testUserEmail,
      },
      // password: {
      //   selector: "#ap_password",
      //   value: "fakeAmazonPassword",
      // },
    },
  },
  // When Twitter sees "unusual login activity", it requests the username or phone number in an intermediate step
  {
    cipherType: CipherType.Login,
    url: "https://twitter.com/login?lang=en",
    inputs: {
      username: {
        // multiStepNextInputKey: "password",
        selector: "input[autocomplete='username']",
        value: testUserEmail,
      },
      // password: {
      //   selector: "input[name='password']",
      //   value: "fakeTwitterPassword",
      // },
    },
  },
  {
    cipherType: CipherType.Login,
    url: "https://login.yahoo.com",
    inputs: {
      username: {
        multiStepNextInputKey: "password",
        selector: "#login-username",
        value: testUserName,
      },
      password: {
        selector: "input#login-passwd",
        value: "fakeYahooPassword",
      },
    },
  },
  {
    cipherType: CipherType.Login,
    url: "https://en.wikipedia.org/w/index.php?title=Special:UserLogin&returnto=Main+Page",
    inputs: {
      username: {
        selector: "#wpName1",
        value: testUserName,
      },
      password: {
        selector: "#wpPassword1",
        value: "fakeWikipediaPassword",
      },
    },
  },
  {
    cipherType: CipherType.Login,
    url: "https://www.instagram.com/accounts/login",
    inputs: {
      username: {
        selector: "input[name='username']",
        value: testUserName,
      },
      password: {
        selector: "input[name='password']",
        value: "fakeInstagramPassword",
      },
    },
  },
  {
    cipherType: CipherType.Login,
    url: "https://auth.fandom.com/signin",
    inputs: {
      username: {
        selector: "input[data-test='signin-username-field']",
        // Fandom's ui auto-capitalizes any user input on the usernamefield
        value: testUserName[0].toUpperCase() + testUserName.slice(1),
      },
      password: {
        selector: "input[data-test='signin-password-field']",
        value: "fakeFandomPassword",
      },
    },
  },
  {
    cipherType: CipherType.Login,
    url: "https://weather.com/login",
    inputs: {
      username: {
        selector: "#loginEmail",
        value: testUserEmail,
      },
      password: {
        selector: "#loginPassword",
        value: "fakeWeatherPassword",
      },
    },
  },
  {
    cipherType: CipherType.Login,
    url: "https://login.live.com",
    inputs: {
      username: {
        multiStepNextInputKey: "password",
        selector: "input[type='email']",
        value: testUserEmail,
      },
      password: {
        selector:
          "input[aria-label='Enter the password for bwplaywright@gmail.com']",
        value: "fakeLivePassword",
      },
    },
  },
  {
    cipherType: CipherType.Login,
    url: "https://login.microsoftonline.com",
    inputs: {
      username: {
        multiStepNextInputKey: "password",
        selector: "input[type='email']",
        value: testUserEmail,
      },
      password: {
        selector:
          "input[aria-label='Enter the password for bwplaywright@gmail.com']",
        value: "fakeMicrosoftOnlinePassword",
      },
    },
  },
  {
    cipherType: CipherType.Login,
    url: "https://www.tiktok.com",
    inputs: {
      username: {
        preFillActions: async (page) => {
          // Open the login options popup
          await page.locator("#header-login-button").click();
          // Select login with phone / email / username
          await page
            .locator("#login-modal a[href^='/login/phone-or-email']")
            .click();
          // Select login with email or username
          await page
            .locator("#login-modal a[href^='/login/phone-or-email/email']")
            .click();
        },
        selector: "input[placeholder='Email or username']",
        value: testUserEmail,
      },
      password: {
        selector: "input[placeholder='Password']",
        value: "fakeTikTokPassword",
      },
    },
  },
  {
    cipherType: CipherType.Login,
    url: "https://www.tiktok.com/login/phone-or-email/email",
    inputs: {
      username: {
        selector: "input[placeholder='Email or username']",
        value: testUserEmail,
      },
      password: {
        selector: "input[placeholder='Password']",
        value: "fakeTikTokPassword",
      },
    },
  },
  {
    cipherType: CipherType.Login,
    url: "https://authentication.taboola.com",
    inputs: {
      username: {
        selector: "#j_username[placeholder='Type Email...']",
        value: testUserEmail,
      },
      password: {
        selector: "#j_password[placeholder='Type Password...']",
        value: "fakeTaboolaPassword",
      },
    },
  },
  {
    cipherType: CipherType.Login,
    url: "https://www.cnn.com/account/log-in",
    inputs: {
      username: {
        selector: "#login-email-input",
        value: testUserEmail,
      },
      password: {
        selector: "#login-password-input",
        value: "fakeCNNPassword",
      },
    },
  },
  {
    cipherType: CipherType.Login,
    url: "https://signin.ebay.com/signin",
    inputs: {
      username: {
        multiStepNextInputKey: "password",
        selector: "#userid",
        value: testUserEmail,
      },
      password: {
        selector: "#pass",
        value: "fakeEbayPassword",
      },
    },
  },
  {
    cipherType: CipherType.Login,
    url: "https://www.twitch.tv",
    inputs: {
      username: {
        preFillActions: async (page) => {
          // Open the login modal
          await page.locator("button[data-a-target='login-button']").click();
        },
        selector: "#login-username",
        value: testUserEmail,
      },
      password: {
        selector: "#password-input",
        value: "fakeTwitchPassword",
      },
    },
  },
  {
    cipherType: CipherType.Login,
    url: "https://www.walmart.com/account/login",
    inputs: {
      username: {
        multiStepNextInputKey: "password",
        selector: 'input[name="Email Address"]',
        value: testUserEmail,
      },
      password: {
        selector: "input[name='password'][type='password']",
        value: "fakeWalmartPassword",
      },
    },
  },
  {
    cipherType: CipherType.Login,
    url: "https://www.quora.com",
    inputs: {
      username: {
        selector: "#email",
        value: testUserEmail,
      },
      password: {
        selector: "#password",
        value: "fakeQuoraPassword",
      },
    },
  },
  {
    cipherType: CipherType.Login,
    url: "https://myaccount.nytimes.com/auth/login",
    inputs: {
      username: {
        multiStepNextInputKey: "password",
        selector: "#email",
        value: testUserEmail,
      },
      password: {
        selector: "#password",
        value: "fakeNYTimesPassword",
      },
    },
  },
  {
    cipherType: CipherType.Login,
    url: "https://my.foxnews.com",
    inputs: {
      username: {
        selector: "input[type='email']",
        value: testUserEmail,
      },
      password: {
        selector: "input[type='password']",
        value: "fakeFoxNewsPassword",
      },
    },
  },
  {
    cipherType: CipherType.Login,
    url: "https://reg.usps.com/entreg/LoginAction_input",
    inputs: {
      username: {
        selector: "#username",
        value: testUserEmail,
      },
      password: {
        selector: "#password",
        value: "fakeUSPSPassword",
      },
    },
  },
  {
    cipherType: CipherType.Login,
    url: "https://www.imdb.com/registration/signin",
    inputs: {
      username: {
        preFillActions: async (page) => {
          // Click the login with IMDB button to be redirected to the login page
          await page
            .locator("a[href^='https://www.imdb.com/ap/signin']")
            .filter({ hasText: "Sign in with IMDb" })
            .click();
        },
        selector: "#ap_email",
        value: testUserEmail,
      },
      password: {
        selector: "#ap_password",
        value: "fakeIMDBPassword",
      },
    },
  },
  {
    cipherType: CipherType.Login,
    url: "https://www.paypal.com/signin",
    inputs: {
      username: {
        multiStepNextInputKey: "password",
        selector: "#email",
        value: testUserEmail,
      },
      password: {
        selector: "#password",
        value: "fakePaypalPassword",
      },
    },
  },
  {
    cipherType: CipherType.Login,
    url: "https://zoom.us/signin",
    inputs: {
      username: {
        selector: "#email",
        value: testUserEmail,
      },
      password: {
        selector: "#password",
        value: "fakeZoomPassword",
      },
    },
  },
  {
    cipherType: CipherType.Login,
    url: "https://discord.com/login",
    inputs: {
      username: {
        selector: "input[aria-label='Email or Phone Number']",
        value: testUserEmail,
      },
      password: {
        selector: "input[aria-label='Password']",
        value: "fakeDiscordPassword",
      },
    },
  },
  {
    cipherType: CipherType.Login,
    url: "https://www.netflix.com/login",
    inputs: {
      username: {
        selector: "#id_userLoginId",
        value: testUserEmail,
      },
      password: {
        selector: "#id_password",
        value: "fakeNetflixPassword",
      },
    },
  },
  {
    cipherType: CipherType.Login,
    url: "https://www.etsy.com",
    inputs: {
      username: {
        preFillActions: async (page) => {
          // Open the sign in modal
          await page.locator("button.signin-header-action").click();
        },
        selector: "#join_neu_email_field",
        value: testUserEmail,
      },
      password: {
        selector: "#join_neu_password_field",
        value: "fakeEtsyPassword",
      },
    },
  },
  {
    cipherType: CipherType.Login,
    url: "https://www.pinterest.com/",
    uriMatchType: UriMatchType.Exact,
    inputs: {
      username: {
        preFillActions: async (page) => {
          // Open the log in modal
          await page
            .locator('div[data-test-id="simple-login-button"]')
            .first()
            .click();
        },
        selector: "#email",
        value: testUserEmail,
      },
      password: {
        selector: "#password",
        value: "fakePinterestPassword",
      },
    },
  },
  {
    cipherType: CipherType.Login,
    url: "https://www.pinterest.com/login/",
    uriMatchType: UriMatchType.Exact,
    inputs: {
      username: {
        selector: "#email",
        value: testUserEmail,
      },
      password: {
        selector: "#password",
        value: "fakePinterestPassword",
      },
    },
  },
  {
    cipherType: CipherType.Login,
    url: "https://github.com/login",
    inputs: {
      username: {
        selector: "#login_field",
        value: testUserEmail,
      },
      password: {
        selector: "#password",
        value: "fakeGithubPassword",
      },
    },
  },
  {
    cipherType: CipherType.Login,
    url: "https://nypost.com/account/login",
    inputs: {
      username: {
        selector: "#email",
        value: testUserEmail,
      },
      password: {
        selector: "#password",
        value: "fakeNYPostPassword",
      },
    },
  },
  {
    cipherType: CipherType.Login,
    url: "https://wwwl.accuweather.com/premium_login.php",
    inputs: {
      username: {
        selector: "#username",
        value: testUserEmail,
      },
      password: {
        selector: "#password",
        value: "fakeAccuweatherPassword",
      },
    },
  },
  {
    cipherType: CipherType.Login,
    url: "https://platform.openai.com/login?launch",
    inputs: {
      username: {
        multiStepNextInputKey: "password",
        selector: "#username",
        value: testUserEmail,
      },
      password: {
        selector: "#password",
        value: "fakeOpenAIPassword",
      },
    },
  },
  {
    cipherType: CipherType.Login,
    url: "https://www.ups.com/lasso/login",
    inputs: {
      username: {
        value: testUserEmail,
        selector: "#email",
        multiStepNextInputKey: "password",
      },
      password: {
        value: "fakeUPSPassword",
        selector: "#pwd",
      },
    },
  },
  // Patreon will sometimes send login links to the email
  // Patreon prequalifies the email and starts account creation workflow if it isn't recognized as an existing account
  {
    cipherType: CipherType.Login,
    url: "https://www.patreon.com/login",
    inputs: {
      username: {
        multiStepNextInputKey: "password",
        selector: "input[name='email']",
        value: testUserEmail,
      },
      // @TODO create Patreon account with test email in order to test password auto-fill
      // password: {
      //   selector: "input[placeholder='Your name']",
      //   value: "fakePatreonPassword",
      // },
    },
  },
  {
    cipherType: CipherType.Login,
    url: "https://imgur.com/signin",
    inputs: {
      username: {
        selector: "#username",
        value: testUserEmail,
      },
      password: {
        selector: "#password",
        value: "fakeImgurPassword",
      },
    },
  },
  {
    cipherType: CipherType.Login,
    url: "https://ign.com",
    inputs: {
      username: {
        preFillActions: async (page) => {
          // Open user account menu
          await page.locator("button.login-avatar").click();
          // Open login modal
          await page
            .locator("button")
            .filter({ hasText: "Login" })
            .first()
            .click();
          // Open the login form
          await page
            .locator("button")
            .filter({ hasText: "Log in with an email or username" })
            .first()
            .click();
        },
        selector: "#email",
        value: testUserEmail,
      },
      password: {
        selector: "#password",
        value: "fakeIGNPassword",
      },
    },
  },
  {
    cipherType: CipherType.Login,
    url: "https://aws.amazon.com",
    additionalLoginUrls: ["https://signin.aws.amazon.com"],
    inputs: {
      username: {
        preFillActions: async (page) => {
          // Click the login link to get redirected to the login domain/page
          await page
            .locator("#aws-page-header a")
            .filter({ hasText: "Sign In" })
            .first()
            .click();
        },
        selector: "input#resolving_input[type='email']",
        value: testUserEmail,
        // multiStepNextInputKey: "password",
      },
      // @TODO create Amazon AWS account with test email in order to test password auto-fill
    },
  },
  {
    cipherType: CipherType.Login,
    url: "https://www.roblox.com/login",
    inputs: {
      username: {
        selector: "#login-username",
        value: testUserEmail,
      },
      password: {
        selector: "#login-password",
        value: "fakeRobloxPassword",
      },
    },
  },
  {
    cipherType: CipherType.Login,
    url: "https://accounts.spotify.com/en/login",
    inputs: {
      username: {
        selector: "#login-username",
        value: testUserEmail,
      },
      password: {
        selector: "#login-password",
        value: "fakeSpotifyPassword",
      },
    },
  },
  {
    cipherType: CipherType.Login,
    url: "https://www.instructure.com/canvas/login/free-for-teacher",
    inputs: {
      username: {
        selector: "#edit-email",
        value: testUserEmail,
      },
      password: {
        selector: "#edit-password",
        value: "fakeInstructurePassword",
      },
    },
  },
  {
    cipherType: CipherType.Login,
    url: "https://badgr.com/auth/login",
    inputs: {
      username: {
        selector: "#email",
        value: testUserEmail,
      },
      password: {
        selector: "#enter-password",
        value: "fakeBadgrPassword",
      },
    },
  },
  {
    cipherType: CipherType.Login,
    url: "https://portfolium.com/login",
    inputs: {
      username: {
        selector: "#pf-simple-sign-in--field--identity",
        value: testUserEmail,
      },
      password: {
        selector: "#pf-simple-sign-in--field--password",
        value: "fakePortfoliumPassword",
      },
    },
  },
  {
    cipherType: CipherType.Login,
    url: "https://app.masteryconnect.com/login",
    inputs: {
      username: {
        selector: "#login",
        value: testUserEmail,
      },
      password: {
        selector: "#password",
        value: "fakeMasteryPassword",
      },
    },
  },
  {
    cipherType: CipherType.Login,
    url: "https://identity.us2.kimonocloud.com/login",
    inputs: {
      username: {
        multiStepNextInputKey: "password",
        selector: "#email",
        value: testUserEmail,
      },
      password: {
        selector: "#password",
        value: "fakeElevateDSPassword",
      },
    },
  },
  {
    cipherType: CipherType.Login,
    url: "https://app.learnplatform.com/users/sign_in",
    inputs: {
      username: {
        selector: "#email",
        value: testUserEmail,
      },
      password: {
        selector: "#password",
        value: "fakeLearnPlatformPassword",
      },
    },
  },
  {
    cipherType: CipherType.Login,
    url: "https://www.target.com/account",
    inputs: {
      username: {
        selector: "#username",
        value: testUserEmail,
      },
      password: {
        selector: "#password",
        value: "fakeTargetPassword",
      },
    },
  },
  {
    cipherType: CipherType.Login,
    url: "https://accounts.craigslist.org/login",
    inputs: {
      username: {
        selector: "#inputEmailHandle",
        value: testUserEmail,
      },
      password: {
        selector: "#inputPassword",
        value: "fakeCraigsListPassword",
      },
    },
  },
  {
    cipherType: CipherType.Login,
    url: "https://www.capitalone.com",
    uriMatchType: UriMatchType.Host,
    inputs: {
      username: {
        selector: "input.login-username",
        value: testUserEmail,
      },
      password: {
        selector: "input.login-password[type='password']",
        value: "fakeCapitalOneWidgetPassword",
      },
    },
  },
  {
    cipherType: CipherType.Login,
    url: "https://verified.capitalone.com/auth/signin",
    uriMatchType: UriMatchType.Host,
    inputs: {
      username: {
        selector: "input[aria-describedby='label-username-input']",
        value: testUserEmail,
      },
      password: {
        selector: "input[aria-describedby='label-password-input']",
        value: "fakeCapitalOnePassword",
      },
    },
  },
  {
    cipherType: CipherType.Login,
    url: "https://www.fedex.com/secure-login",
    inputs: {
      username: {
        selector: "#userId",
        value: testUserEmail,
      },
      password: {
        selector: "#password",
        value: "fakeFedExPassword",
      },
    },
  },
  {
    cipherType: CipherType.Login,
    url: "https://www.tumblr.com",
    inputs: {
      username: {
        // multiStepNextInputKey: "password",
        preFillActions: async (page) => {
          // Click the login button to bring up the account modal
          await page.locator("a").filter({ hasText: "Log In" }).first().click();
          // Click the "Continue with email" button
          await page
            .locator('button[aria-label="Continue with email"]')
            .first()
            .click();
        },
        selector: "input[name='email']",
        value: testUserEmail,
      },
      // @TODO create tumblr account with test email in order to test password auto-fill
    },
  },
  {
    cipherType: CipherType.Login,
    url: "https://seguro.marca.com/registro/v3/?view=login",
    inputs: {
      username: {
        selector: "#inputEmailLogin",
        value: testUserEmail,
      },
      // @TODO create marca account with test email in order to test password auto-fill
    },
  },
  {
    cipherType: CipherType.Login,
    url: "https://www.bestbuy.com/identity/global/signin",
    inputs: {
      username: {
        selector: "#fld-e",
        value: testUserEmail,
      },
      password: {
        selector: "#fld-p1",
        value: "fakeBestBuyPassword",
      },
    },
  },
  {
    cipherType: CipherType.Login,
    url: "https://www.adobe.com",
    inputs: {
      username: {
        preFillActions: async (page) => {
          // Click the login button to get redirected to the login page (with token)
          await page
            .locator("span.feds-login-text")
            .filter({ hasText: "Sign In" })
            .first()
            .click();
        },
        selector: "#EmailPage-EmailField",
        value: testUserEmail,
        // multiStepNextInputKey: "password",
      },
      // @TODO create an adobe account with test email in order to test password auto-fill
    },
  },
  {
    cipherType: CipherType.Login,
    url: "https://auth.hulu.com/web/login",
    inputs: {
      username: {
        selector: "input[data-automationid='email-field']",
        value: testUserEmail,
      },
      password: {
        selector: "input[data-automationid='password-field']",
        value: "fakeHuluPassword",
      },
    },
  },
  {
    cipherType: CipherType.Login,
    url: "https://account.bbc.com/signin",
    inputs: {
      username: {
        selector: "#user-identifier-input",
        value: testUserEmail,
      },
      password: {
        selector: "#password-input",
        value: "fakeBBCPassword",
      },
    },
  },
  {
    cipherType: CipherType.Login,
    url: "https://steamcommunity.com/login/home",
    uriMatchType: UriMatchType.Exact,
    inputs: {
      username: {
        selector:
          "form div:has-text('Sign in with account name') input[type='text']",
        value: testUserEmail,
      },
      password: {
        selector: "form input[type='password']",
        value: "fakeSteamCommunityPassword",
      },
    },
  },
  {
    cipherType: CipherType.Login,
    url: "https://store.steampowered.com/login",
    uriMatchType: UriMatchType.Exact,
    inputs: {
      username: {
        selector:
          "form div:has-text('Sign in with account name') input[type='text']",
        value: testUserEmail,
      },
      password: {
        selector: "form input[type='password']",
        value: "fakeSteamStorePassword",
      },
    },
  },
  {
    cipherType: CipherType.Login,
    url: "https://www.lowes.com/u/login",
    inputs: {
      username: {
        selector: "#email",
        value: testUserEmail,
      },
      password: {
        selector: "#user-password",
        value: "fakeLowesPassword",
      },
    },
  },
  {
    cipherType: CipherType.Login,
    url: "https://login.xfinity.com/login",
    inputs: {
      username: {
        // multiStepNextInputKey: "password",
        selector: "#user",
        value: testUserEmail,
      },
      // @TODO create an xfinity account with test email in order to test password auto-fill
    },
  },
  {
    cipherType: CipherType.Login,
    url: "https://www.bezzypsa.com/signin/SIGNIN",
    inputs: {
      username: {
        selector: "#signin-email",
        value: testUserEmail,
      },
      password: {
        selector: "#signin-password",
        value: "fakeBezzyPassword",
      },
    },
  },
  {
    cipherType: CipherType.Login,
    url: "https://www.yelp.com/login",
    inputs: {
      username: {
        selector: ".login form #email",
        value: testUserEmail,
      },
      password: {
        selector: ".login form #password",
        value: "fakeYelpPassword",
      },
    },
  },
  {
    cipherType: CipherType.Login,
    url: "https://wordpress.com/log-in",
    inputs: {
      username: {
        // multiStepNextInputKey: "password",
        selector: "#usernameOrEmail",
        value: testUserEmail,
      },
      // @TODO create a Wordpress account with test email in order to test password auto-fill
    },
  },
  {
    cipherType: CipherType.Login,
    url: "https://nextdoor.com/login",
    inputs: {
      username: {
        selector: "#id_email",
        value: testUserEmail,
      },
      password: {
        selector: "#id_password",
        value: "fakeNextdoorPassword",
      },
    },
  },
  {
    cipherType: CipherType.Login,
    url: "https://linktr.ee/login",
    inputs: {
      username: {
        selector: "input[name='username']",
        value: testUserName,
      },
      password: {
        selector: "input[name='password']",
        value: "fakeLinktreePassword",
      },
    },
  },
  {
    cipherType: CipherType.Login,
    url: "https://quizlet.com",
    inputs: {
      username: {
        preFillActions: async (page) => {
          // Click the log in button to trigger the login modal
          await page.locator("button").filter({ hasText: "Log in" }).click();
        },
        selector: "#username",
        value: testUserEmail,
      },
      password: {
        selector: "#password",
        value: "fakeQuizletPassword",
      },
    },
  },
  {
    cipherType: CipherType.Login,
    url: "https://realtor.com",
    inputs: {
      username: {
        multiStepNextInputKey: "password",
        preFillActions: async (page) => {
          // Click the log in button to trigger the login modal
          const loginButton = await page.locator(
            "a.user-profile_header-login[href='/myaccount']"
          );
          await loginButton.click();
        },
        selector: "#raas_email",
        value: testUserEmail,
      },
      password: {
        selector: "#raas_password",
        value: "fakeRealtorPassword",
      },
    },
  },
  // Canva prequalifies the email and starts account creation workflow if it isn't recognized as an existing account
  {
    cipherType: CipherType.Login,
    url: "https://www.canva.com",
    inputs: {
      username: {
        // multiStepNextInputKey: "password",
        preFillActions: async (page) => {
          // Click the log in button to trigger the login modal
          await page
            .locator("header button span")
            .filter({ hasText: "Log in" })
            .first()
            .click();
          // Select Continue with email option
          await page
            .locator("button")
            .filter({ hasText: "Continue with email" })
            .click();
        },
        selector: "input[name='email']",
        value: testUserEmail,
      },
      // @TODO create a Canva account with test email in order to test password auto-fill
    },
  },
  {
    cipherType: CipherType.Login,
    url: "https://www.att.com/acctmgmt/login",
    inputs: {
      username: {
        multiStepNextInputKey: "password",
        selector: "#userID",
        value: testUserEmail,
      },
      password: {
        selector: "#password",
        value: "fakeATTPassword",
      },
    },
  },
  {
    cipherType: CipherType.Login,
    url: "https://auth0.com/api/auth/login",
    additionalLoginUrls: ["https://auth0.auth0.com"],
    uriMatchType: UriMatchType.Host,
    inputs: {
      username: {
        multiStepNextInputKey: "password",
        selector: "#username",
        value: testUserEmail,
      },
      password: {
        selector: "#password",
        value: "fakeAuth0Password",
      },
    },
  },
  {
    cipherType: CipherType.Login,
    url: "https://www.washingtonpost.com/subscribe/signin",
    inputs: {
      username: {
        // multiStepNextInputKey: "password",
        selector: "#username",
        value: testUserEmail,
      },
      // @TODO create a Washington Post account with test email in order to test password auto-fill
    },
  },
  // AOL uses a captcha between username entry and password entry
  {
    cipherType: CipherType.Login,
    url: "https://login.aol.com",
    inputs: {
      username: {
        // multiStepNextInputKey: "password",
        selector: "#login-username",
        value: testUserEmail,
      },
      // @TODO create a Washington Post account with test email in order to test password auto-fill
    },
  },
  {
    cipherType: CipherType.Login,
    url: "https://www.t-mobile.com",
    inputs: {
      username: {
        // multiStepNextInputKey: "password",
        preFillActions: async (page) => {
          // Click the reject button on the interaction analysis modal
          await page.locator("#onetrust-reject-all-handler").click();
          // Click the log in button to trigger the login modal
          await page
            .locator("button")
            .filter({ hasText: "Log in" })
            .first()
            .click();
          // Select Continue with email option
          await page
            .locator(".unav-account__dropdown a")
            .filter({ hasText: "Log in" })
            .click();
        },
        selector: "#usernameTextBox",
        value: testUserEmail,
      },
      // @TODO create a t-mobile account with test email in order to test password auto-fill
    },
  },
  {
    cipherType: CipherType.Login,
    url: "https://login.okta.com/signin",
    inputs: {
      username: {
        selector: "#okta-signin-username",
        value: testUserEmail,
      },
      password: {
        selector: "#okta-signin-password",
        value: "fakeOktaSupportPassword",
      },
    },
  },
  {
    cipherType: CipherType.Login,
    url: "https://bethesda.net",
    inputs: {
      username: {
        preFillActions: async (page) => {
          // Click the LOG IN / SIGN UP button to bring up the login modal
          await page
            .locator("button span")
            .filter({ hasText: "Log In / Sign Up" })
            .click();
        },
        selector: "#username-input",
        value: testUserEmail,
      },
      password: {
        selector: "#password-input",
        value: "fakeBethesdaPassword",
      },
    },
  },
];

// Known failure cases; expected to fail
export const knownFailureCases: TestPage[] = [
  {
    cipherType: CipherType.Login,
    url: `${testSiteHost}/forms/login/many-inputs-login`,
    uriMatchType: UriMatchType.StartsWith,
    inputs: {
      username: { selector: "#username", value: "js" },
      password: { selector: "#password", value: "" },
    },
  },
  // The Reddit modal sign in inputs are nested under several levels of shadow roots
  {
    cipherType: CipherType.Login,
    url: "https://www.reddit.com",
    inputs: {
      username: {
        preFillActions: async (page) => {
          // Open login modal
          await page
            .locator('header a[href^="https://www.reddit.com/login"]')
            .click();
          // Select login option from registration form
          const loadedLoginModal = await page.locator(
            'form div.login a[href^="/account/login"]'
          );
          loadedLoginModal.click();
        },
        selector: "#loginUsername",
        value: testUserName,
      },
      password: {
        selector: "#loginPassword",
        value: "fakeRedditInlineLoginPassword",
      },
    },
  },
  // The Max sign in inputs are nested two-deep within shadow roots
  {
    cipherType: CipherType.Login,
    url: "https://auth.max.com/login",
    inputs: {
      username: { selector: "#username", value: "maxcom_user" },
      password: { selector: "#password", value: "maxcom_password" },
    },
  },
  // Each Clear login input is nested within a shadow root
  {
    cipherType: CipherType.Login,
    url: "https://login.clear.com.br",
    inputs: {
      // Clear expects numerically-formatted values
      username: { selector: "#username", value: "12345678901111" },
      password: { selector: "#password", value: "098765" },
    },
  },
  // Auto-fill is targeting the registration form (on the same page) over the login form which appears after
  {
    cipherType: CipherType.Login,
    url: "https://www.gamespot.com/login-signup",
    inputs: {
      username: {
        selector: "#form__username",
        value: testUserEmail,
      },
      password: {
        selector: "#form__password",
        value: "fakeGamespotPassword",
      },
    },
  },
  // Temu sometimes has a captcha challenge before showing the password field.
  {
    cipherType: CipherType.Login,
    url: "https://temu.com",
    inputs: {
      username: {
        multiStepNextInputKey: "password",
        preFillActions: async (page) => {
          // Await and dismiss promo modals
          await page.locator('div[role="dialog"]');
          await page
            .locator('div[role="dialog"] img[alt="close icon"]')
            .click();
          // Click the login/account button to trigger the login modal
          await page
            .locator('#mainHeader .mainContent div[role="button"]')
            .filter({ hasText: "Sign in / Register" })
            .first()
            .click();
        },
        selector: "#user-account",
        value: testUserEmail,
      },
      password: {
        selector: "#pwdInputInLoginDialog",
        value: "fakeTemuPassword",
      },
    },
  },
  {
    cipherType: CipherType.Login,
    url: "https://www.temu.com/login.html",
    inputs: {
      username: {
        multiStepNextInputKey: "password",
        selector: "#user-account",
        value: testUserEmail,
      },
      password: {
        selector: "#pwdInputInLoginDialog",
        value: "fakeTemuLoginPagePassword",
      },
    },
  },
  // Apple sign in form is within an iframe
  {
    cipherType: CipherType.Login,
    url: "https://www.apple.com",
    inputs: {
      username: {
        multiStepNextInputKey: "password",
        preFillActions: async (page) => {
          // Click the store button to get the dropdown menu which includes the link to the login page
          await page.locator("a#globalnav-menubutton-link-bag").click();
          // Click the log in link to be redirected to the login page
          await page.locator('a[data-autom="sign-in"]').first().click();
        },
        selector: "#account_name_text_field",
        value: testUserEmail,
      },
      password: {
        selector: "#password_text_field",
        value: "fakeApplePassword",
      },
    },
  },
  // Marvel sign in form is within an iframe
  // Note; marvel.com has it's own login but checks against the existence of a Disney account before allowing password entry
  {
    cipherType: CipherType.Login,
    url: "https://www.marvel.com/signin",
    inputs: {
      username: {
        multiStepNextInputKey: "password",
        selector: "#InputIdentityFlowValue",
        value: testUserEmail,
      },
      password: {
        selector: "#InputPassword",
        value: "fakeMarvelPassword",
      },
    },
  },
  // ESPN sign in form is within an iframe; autofill will only work if the iframe domain is added to `additionalLoginUrls`
  {
    cipherType: CipherType.Login,
    url: "https://www.espn.com",
    // additionalLoginUrls: [
    //   "https://cdn.registerdisney.go.com/v4/bundle/web/ESPN-ONESITE.WEB",
    // ],
    inputs: {
      username: {
        multiStepNextInputKey: "password",
        preFillActions: async (page) => {
          // Open the account sidebar/menu
          await page.locator("#global-user-trigger").click();
          await page
            .locator(
              '#global-viewport > .global-user a[tref="/members/v3_1/login"]'
            )
            .click();
        },
        selector: "input[data-testid='InputIdentityFlowValue']",
        value: testUserEmail,
      },
      password: {
        selector: "#InputPassword",
        value: "fakeESPNPassword",
      },
    },
  },
];

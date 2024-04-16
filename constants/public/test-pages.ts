import { testUserEmail, testUserName } from "../settings";
import { TestNames } from "../test-pages";
import { PageTest } from "../../abstractions";

// Live website test pages and instructions for interactions
// Inclusion is roughly based on public traffic statistics as well as known popular user cases
// Tests and notes here should be considered experimental and non-authoritative
export const testPages: PageTest[] = [
  // @TODO In non-debug mode, LinkedIn is often hanging on page load
  // LinkedIn periodically redirects to https://www.linkedin.com/authwall...
  {
    url: "https://www.linkedin.com/",
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
    url: "https://www.linkedin.com/login",
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
    url: "https://www.zillow.com",
    inputs: {
      username: {
        preFillActions: async (page) => {
          // Open the login options modal
          await page
            .locator(
              "header nav .znav-links ul[data-zg-section='reg-login'] a[href^='/user/acct/login/?cid=pf']",
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
    url: "https://beta.character.ai/",
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
    url: "https://www.pinterest.com/",
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
    url: "https://www.pinterest.com/login/",
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
    url: "https://aws.amazon.com",
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
    url: "https://www.capitalone.com",
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
    url: "https://verified.capitalone.com/auth/signin",
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
    url: "https://steamcommunity.com/login/home",
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
    url: "https://store.steampowered.com/login",
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
    url: "https://realtor.com",
    inputs: {
      username: {
        multiStepNextInputKey: "password",
        preFillActions: async (page) => {
          // Click the log in button to trigger the login modal
          const loginButton = await page.locator(
            "a.user-profile_header-login[href='/myaccount']",
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
    url: "https://auth0.com/api/auth/login",
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

  // Known failure cases; expected to fail
  {
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
            'form div.login a[href^="/account/login"]',
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
    skipTests: [
      // @TODO known failure: The Reddit modal sign in inputs are nested under several levels of shadow roots
      TestNames.InlineMenuAutofill,
    ],
  },
  {
    url: "https://auth.max.com/login",
    inputs: {
      username: { selector: "#username", value: "maxcom_user" },
      password: { selector: "#password", value: "maxcom_password" },
    },
    skipTests: [
      // @TODO known failure: The Max sign in inputs are nested two-deep within shadow roots
      TestNames.InlineMenuAutofill,
    ],
  },
  {
    url: "https://login.clear.com.br",
    inputs: {
      // Clear expects numerically-formatted values
      username: { selector: "#username", value: "12345678901111" },
      password: { selector: "#password", value: "098765" },
    },
    skipTests: [
      // @TODO known failure: Each Clear login input is nested within a shadow root
      TestNames.InlineMenuAutofill,
    ],
  },
  {
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
    skipTests: [
      // @TODO known failure: Auto-fill is targeting the registration form (on the same page) over the login form which appears after
      TestNames.InlineMenuAutofill,
    ],
  },
  {
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
    skipTests: [
      // @TODO known failure: Temu sometimes has a captcha challenge before showing the password field.
      TestNames.InlineMenuAutofill,
    ],
  },
  {
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
  {
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
    skipTests: [
      // @TODO known failure: Apple sign in form is within an iframe
      TestNames.InlineMenuAutofill,
    ],
  },
  {
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
    skipTests: [
      // @TODO known failure: Marvel sign in form is within an iframe. Note: marvel.com has its own login but checks against the existence of a Disney account before allowing password entry
      TestNames.InlineMenuAutofill,
    ],
  },
  {
    url: "https://www.espn.com",
    inputs: {
      username: {
        multiStepNextInputKey: "password",
        preFillActions: async (page) => {
          // Open the account sidebar/menu
          await page.locator("#global-user-trigger").click();
          await page
            .locator(
              '#global-viewport > .global-user a[tref="/members/v3_1/login"]',
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
    skipTests: [
      // @TODO known failure: ESPN sign in form is within an iframe; autofill will only work if the iframe domain is added to `additionalLoginUrls`
      TestNames.InlineMenuAutofill,
    ],
  },
];

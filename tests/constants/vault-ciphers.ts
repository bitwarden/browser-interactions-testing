import { PageCipher, CipherType, UriMatchType } from "../../abstractions";
import { testSiteHost } from "./server";
import {
  testUserName,
  testEmail,
  testUserEmail,
  testTotpSeed,
} from "./settings";

/*
  Ciphers to seed the vault with

  Notes:
    - field property `name` refers to the custom field selector used to find the input on the page
    - fields `username` and `password` (and other predefined field types) do not have selector/`name` attributes (as they otherwise have find/fill logic defined)
*/

// Ciphers for the locally hosted test site
export const localPageCiphers: PageCipher[] = [
  {
    cipherType: CipherType.Login,
    url: `${testSiteHost}/forms/login/simple`,
    uriMatchType: UriMatchType.StartsWith,
    fields: {
      username: { value: testUserName },
      password: { value: "fakeBasicFormPassword" },
    },
  },
  {
    cipherType: CipherType.Login,
    url: `${testSiteHost}/forms/login/iframe-login`,
    additionalLoginUrls: [`${testSiteHost}/login-page-bare`],
    uriMatchType: UriMatchType.StartsWith,
    fields: {
      username: {
        value: testUserName,
      },
      password: {
        value: "fakeIframeBasicFormPassword",
      },
    },
  },
  {
    cipherType: CipherType.Login,
    url: `${testSiteHost}/forms/login/iframe-sandboxed-login`,
    uriMatchType: UriMatchType.StartsWith,
    fields: {
      username: {
        value: testUserName,
      },
      password: {
        value: "fakeSandboxedIframeBasicFormPassword",
      },
    },
  },
  {
    cipherType: CipherType.Login,
    url: `${testSiteHost}/forms/login/bare-inputs-login`,
    uriMatchType: UriMatchType.StartsWith,
    fields: {
      username: { value: testUserName },
      password: { value: "fakeBareInputsPassword" },
    },
  },
  {
    cipherType: CipherType.Login,
    url: `${testSiteHost}/forms/login/hidden-login`,
    uriMatchType: UriMatchType.StartsWith,
    fields: {
      username: { value: testUserName },
      email: { name: "email", value: testEmail },
      password: { value: "fakeHiddenFormPassword" },
    },
  },

  {
    cipherType: CipherType.Login,
    url: `${testSiteHost}/forms/login/input-constraints-login`,
    uriMatchType: UriMatchType.StartsWith,
    fields: {
      username: { value: testEmail },
      password: {
        value: "123456",
      },
    },
  },
  {
    cipherType: CipherType.Login,
    url: `${testSiteHost}/forms/login/login-honeypot`,
    uriMatchType: UriMatchType.StartsWith,
    fields: {
      username: { value: testUserName },
      password: { value: "fakeLoginHoneypotPassword" },
    },
  },
  {
    cipherType: CipherType.Login,
    url: `${testSiteHost}/forms/login/multi-step-login`,
    uriMatchType: UriMatchType.StartsWith,
    fields: {
      username: {
        value: testUserName,
      },
      email: {
        name: "email",
        value: testEmail,
      },
      password: { value: "fakeMultiStepPassword" },
    },
  },
  {
    cipherType: CipherType.Login,
    url: `${testSiteHost}/forms/login/security-code-multi-input`,
    uriMatchType: UriMatchType.StartsWith,
    totpSecret: testTotpSeed + "security-code-multi-input",
  },
  {
    cipherType: CipherType.Login,
    url: `${testSiteHost}/forms/login/shadow-root-inputs`,
    uriMatchType: UriMatchType.StartsWith,
    fields: {
      username: {
        value: testUserName,
      },
      password: {
        value: "fakeShadowRootInputsPassword",
      },
    },
  },
  {
    cipherType: CipherType.Login,
    url: `${testSiteHost}/forms/create/create-account`,
    uriMatchType: UriMatchType.StartsWith,
    fields: {
      username: {
        value: testEmail,
      },
      password: {
        value: "fakeCreateAccountPagePassword",
      },
    },
  },
  {
    cipherType: CipherType.Identity,
    url: `${testSiteHost}/forms/identity/address-na`,
    uriMatchType: UriMatchType.StartsWith,
    fields: {
      firstName: { value: "John" },
      middleName: { value: "M" },
      lastName: { value: "Smith" },
      address1: { value: "123 Main St" },
      address2: { value: "Apt 1" },
      city: { value: "New York" },
      state: { value: "NY" },
      postalCode: { value: "10001" },
      country: { value: "USA" },
    },
  },
  {
    cipherType: CipherType.Card,
    url: `${testSiteHost}/forms/payment/card-payment`,
    uriMatchType: UriMatchType.StartsWith,
    fields: {
      cardholderName: { value: "John Smith" },
      brand: { value: "Visa" },
      number: { value: "4111111111111111" },
      expMonth: { value: "12" },
      expYear: { value: "2025" },
      code: { value: "123" },
    },
  },
  {
    cipherType: CipherType.Login,
    url: `${testSiteHost}/forms/search/simple-search`,
    uriMatchType: UriMatchType.StartsWith,
    fields: {
      username: {
        value: testUserName,
      },
      password: {
        value: "fakeSimpleSearchPassword",
      },
    },
  },
  {
    cipherType: CipherType.Login,
    url: `${testSiteHost}/forms/search/inline-search`,
    uriMatchType: UriMatchType.StartsWith,
    fields: {
      username: {
        value: testUserName,
      },
      password: {
        value: "fakeInlineSearchPassword",
      },
    },
  },
  {
    cipherType: CipherType.Login,
    url: `${testSiteHost}/forms/search/typeless-search`,
    uriMatchType: UriMatchType.StartsWith,
    fields: {
      username: {
        value: testUserName,
      },
      password: {
        value: "fakeTypelessSearchPassword",
      },
    },
  },
  {
    cipherType: CipherType.Login,
    url: `${testSiteHost}/forms/update/update-email`,
    uriMatchType: UriMatchType.StartsWith,
    fields: {
      username: {
        value: testEmail,
      },
      password: {
        value: "fakeUpdateEmailPagePassword",
      },
    },
  },
  {
    cipherType: CipherType.Login,
    url: `${testSiteHost}/forms/update/update-password`,
    uriMatchType: UriMatchType.StartsWith,
    fields: {
      username: {
        value: testEmail,
      },
      password: {
        value: "fakeUpdatePasswordPagePassword",
      },
    },
  },
];

// Ciphers for live websites
// inclusion is roughly based on public traffic statistics as well as known popular user cases
export const publicPageCiphers = [
  {
    cipherType: CipherType.Login,
    url: "https://www.linkedin.com/",
    additionalLoginUrls: ["https://www.linkedin.com/?original_referer="],
    uriMatchType: UriMatchType.Exact,
    fields: {
      username: {
        value: testUserEmail,
      },
      password: {
        value: "fakeLinkedInHomepageLoginPassword",
      },
    },
  },
  {
    cipherType: CipherType.Login,
    url: "https://www.linkedin.com/login",
    uriMatchType: UriMatchType.Exact,
    fields: {
      username: {
        value: testUserEmail,
      },
      password: {
        value: "fakeLinkedInPassword",
      },
    },
  },
  {
    cipherType: CipherType.Login,
    url: "https://account.samsung.com/membership/auth/sign-in",
    fields: {
      username: {
        value: testUserEmail,
      },
    },
  },
  {
    cipherType: CipherType.Login,
    url: "https://www.zillow.com",
    fields: {
      username: {
        value: testUserEmail,
      },
      password: {
        value: "fakeZillowPassword",
      },
    },
  },
  {
    cipherType: CipherType.Login,
    url: "https://beta.character.ai/",
    additionalLoginUrls: ["https://character-ai.us.auth0.com"],
    uriMatchType: UriMatchType.Host,
    fields: {
      username: {
        value: testUserEmail,
      },
      password: {
        value: "fakeCharacterAIPassword",
      },
    },
  },
  {
    cipherType: CipherType.Login,
    url: "https://secure.indeed.com/auth",
    fields: {
      username: {
        value: testUserEmail,
      },
      password: {
        value: "fakeIndeedPassword",
      },
    },
  },
  {
    cipherType: CipherType.Login,
    url: "https://www.homedepot.com/auth/view/signin",
    fields: {
      username: {
        value: testUserEmail,
      },
      password: {
        value: "fakeHomeDepotPassword",
      },
    },
  },
  {
    cipherType: CipherType.Login,
    url: "https://www.dailymail.co.uk/registration/login.html",
    fields: {
      username: {
        value: testUserEmail,
      },
      password: {
        value: "fakeDailyMailPassword",
      },
    },
  },
  {
    cipherType: CipherType.Login,
    url: "https://accounts.google.com",
    fields: {
      username: {
        value: testUserEmail,
      },
      password: {
        value: "fakeGooglePassword",
      },
    },
  },
  {
    cipherType: CipherType.Login,
    url: "https://www.facebook.com",
    fields: {
      username: {
        value: testUserEmail,
      },
      password: {
        value: "fakeFacebookPassword",
      },
    },
  },
  {
    cipherType: CipherType.Login,
    url: "https://www.reddit.com/login",
    fields: {
      username: {
        value: testUserName,
      },
      password: {
        value: "fakeRedditLoginPagePassword",
      },
    },
  },
  {
    cipherType: CipherType.Login,
    url: "https://www.amazon.com/gp/sign-in.html",
    fields: {
      username: {
        value: testUserEmail,
      },
      password: {
        value: "fakeAmazonPassword",
      },
    },
  },
  {
    cipherType: CipherType.Login,
    url: "https://twitter.com/login?lang=en",
    fields: {
      username: {
        value: testUserEmail,
      },
      password: {
        value: "fakeTwitterPassword",
      },
    },
  },
  {
    cipherType: CipherType.Login,
    url: "https://login.yahoo.com",
    fields: {
      username: {
        value: testUserName,
      },
      password: {
        value: "fakeYahooPassword",
      },
    },
  },
  {
    cipherType: CipherType.Login,
    url: "https://en.wikipedia.org/w/index.php?title=Special:UserLogin&returnto=Main+Page",
    fields: {
      username: {
        value: testUserName,
      },
      password: {
        value: "fakeWikipediaPassword",
      },
    },
  },
  {
    cipherType: CipherType.Login,
    url: "https://www.instagram.com/accounts/login",
    fields: {
      username: {
        value: testUserName,
      },
      password: {
        value: "fakeInstagramPassword",
      },
    },
  },
  {
    cipherType: CipherType.Login,
    url: "https://auth.fandom.com/signin",
    fields: {
      username: {
        // Fandom's ui auto-capitalizes any user input on the usernamefield
        value: testUserName[0].toUpperCase() + testUserName.slice(1),
      },
      password: {
        value: "fakeFandomPassword",
      },
    },
  },
  {
    cipherType: CipherType.Login,
    url: "https://weather.com/login",
    fields: {
      username: {
        value: testUserEmail,
      },
      password: {
        value: "fakeWeatherPassword",
      },
    },
  },
  {
    cipherType: CipherType.Login,
    url: "https://login.live.com",
    fields: {
      username: {
        value: testUserEmail,
      },
      password: {
        value: "fakeLivePassword",
      },
    },
  },
  {
    cipherType: CipherType.Login,
    url: "https://login.microsoftonline.com",
    fields: {
      username: {
        value: testUserEmail,
      },
      password: {
        value: "fakeMicrosoftOnlinePassword",
      },
    },
  },
  {
    cipherType: CipherType.Login,
    url: "https://www.tiktok.com",
    fields: {
      username: {
        value: testUserEmail,
      },
      password: {
        value: "fakeTikTokPassword",
      },
    },
  },
  {
    cipherType: CipherType.Login,
    url: "https://www.tiktok.com/login/phone-or-email/email",
    fields: {
      username: {
        value: testUserEmail,
      },
      password: {
        value: "fakeTikTokPassword",
      },
    },
  },
  {
    cipherType: CipherType.Login,
    url: "https://authentication.taboola.com",
    fields: {
      username: {
        value: testUserEmail,
      },
      password: {
        value: "fakeTaboolaPassword",
      },
    },
  },
  {
    cipherType: CipherType.Login,
    url: "https://www.cnn.com/account/log-in",
    fields: {
      username: {
        value: testUserEmail,
      },
      password: {
        value: "fakeCNNPassword",
      },
    },
  },
  {
    cipherType: CipherType.Login,
    url: "https://signin.ebay.com/signin",
    fields: {
      username: {
        value: testUserEmail,
      },
      password: {
        value: "fakeEbayPassword",
      },
    },
  },
  {
    cipherType: CipherType.Login,
    url: "https://www.twitch.tv",
    fields: {
      username: {
        value: testUserEmail,
      },
      password: {
        value: "fakeTwitchPassword",
      },
    },
  },
  {
    cipherType: CipherType.Login,
    url: "https://www.walmart.com/account/login",
    fields: {
      username: {
        value: testUserEmail,
      },
      password: {
        value: "fakeWalmartPassword",
      },
    },
  },
  {
    cipherType: CipherType.Login,
    url: "https://www.quora.com",
    fields: {
      username: {
        value: testUserEmail,
      },
      password: {
        value: "fakeQuoraPassword",
      },
    },
  },
  {
    cipherType: CipherType.Login,
    url: "https://myaccount.nytimes.com/auth/login",
    fields: {
      username: {
        value: testUserEmail,
      },
      password: {
        value: "fakeNYTimesPassword",
      },
    },
  },
  {
    cipherType: CipherType.Login,
    url: "https://my.foxnews.com",
    fields: {
      username: {
        value: testUserEmail,
      },
      password: {
        value: "fakeFoxNewsPassword",
      },
    },
  },
  {
    cipherType: CipherType.Login,
    url: "https://reg.usps.com/entreg/LoginAction_input",
    fields: {
      username: {
        value: testUserEmail,
      },
      password: {
        value: "fakeUSPSPassword",
      },
    },
  },
  {
    cipherType: CipherType.Login,
    url: "https://www.imdb.com/registration/signin",
    fields: {
      username: {
        value: testUserEmail,
      },
      password: {
        value: "fakeIMDBPassword",
      },
    },
  },
  {
    cipherType: CipherType.Login,
    // equivalent to `www.paypal.com/signin` for testing purposes
    url: "https://www.sandbox.paypal.com/signin",
    totpSecret: testTotpSeed + "paypal-signin",
    fields: {
      username: {
        value: testUserEmail,
      },
      password: {
        value: "fakePaypalPassword",
      },
    },
  },
  {
    cipherType: CipherType.Login,
    url: "https://zoom.us/signin",
    fields: {
      username: {
        value: testUserEmail,
      },
      password: {
        value: "fakeZoomPassword",
      },
    },
  },
  {
    cipherType: CipherType.Login,
    url: "https://discord.com/login",
    fields: {
      username: {
        value: testUserEmail,
      },
      password: {
        value: "fakeDiscordPassword",
      },
    },
  },
  {
    cipherType: CipherType.Login,
    url: "https://www.netflix.com/login",
    fields: {
      username: {
        value: testUserEmail,
      },
      password: {
        value: "fakeNetflixPassword",
      },
    },
  },
  {
    cipherType: CipherType.Login,
    url: "https://www.etsy.com",
    fields: {
      username: {
        value: testUserEmail,
      },
      password: {
        value: "fakeEtsyPassword",
      },
    },
  },
  {
    cipherType: CipherType.Login,
    url: "https://www.pinterest.com/",
    uriMatchType: UriMatchType.Exact,
    fields: {
      username: {
        value: testUserEmail,
      },
      password: {
        value: "fakePinterestPassword",
      },
    },
  },
  {
    cipherType: CipherType.Login,
    url: "https://www.pinterest.com/login/",
    uriMatchType: UriMatchType.Exact,
    fields: {
      username: {
        value: testUserEmail,
      },
      password: {
        value: "fakePinterestPassword",
      },
    },
  },
  {
    cipherType: CipherType.Login,
    url: "https://github.com/login",
    fields: {
      username: {
        value: testUserEmail,
      },
      password: {
        value: "fakeGithubPassword",
      },
    },
  },
  {
    cipherType: CipherType.Login,
    url: "https://nypost.com/account/login",
    fields: {
      username: {
        value: testUserEmail,
      },
      password: {
        value: "fakeNYPostPassword",
      },
    },
  },
  {
    cipherType: CipherType.Login,
    url: "https://wwwl.accuweather.com/premium_login.php",
    fields: {
      username: {
        value: testUserEmail,
      },
      password: {
        value: "fakeAccuweatherPassword",
      },
    },
  },
  {
    cipherType: CipherType.Login,
    url: "https://platform.openai.com/login?launch",
    fields: {
      username: {
        value: testUserEmail,
      },
      password: {
        value: "fakeOpenAIPassword",
      },
    },
  },
  {
    cipherType: CipherType.Login,
    url: "https://www.ups.com/lasso/login",
    fields: {
      username: {
        value: testUserEmail,
      },
      password: {
        value: "fakeUPSPassword",
      },
    },
  },
  {
    cipherType: CipherType.Login,
    url: "https://www.patreon.com/login",
    fields: {
      username: {
        value: testUserEmail,
      },
      password: {
        value: "fakePatreonPassword",
      },
    },
  },
  {
    cipherType: CipherType.Login,
    url: "https://imgur.com/signin",
    fields: {
      username: {
        value: testUserEmail,
      },
      password: {
        value: "fakeImgurPassword",
      },
    },
  },
  {
    cipherType: CipherType.Login,
    url: "https://ign.com",
    fields: {
      username: {
        value: testUserEmail,
      },
      password: {
        value: "fakeIGNPassword",
      },
    },
  },
  {
    cipherType: CipherType.Login,
    url: "https://aws.amazon.com",
    additionalLoginUrls: ["https://signin.aws.amazon.com"],
    fields: {
      username: {
        value: testUserEmail,
      },
    },
  },
  {
    cipherType: CipherType.Login,
    url: "https://www.roblox.com/login",
    fields: {
      username: {
        value: testUserEmail,
      },
      password: {
        value: "fakeRobloxPassword",
      },
    },
  },
  {
    cipherType: CipherType.Login,
    url: "https://accounts.spotify.com/en/login",
    fields: {
      username: {
        value: testUserEmail,
      },
      password: {
        value: "fakeSpotifyPassword",
      },
    },
  },
  {
    cipherType: CipherType.Login,
    url: "https://www.instructure.com/canvas/login/free-for-teacher",
    fields: {
      username: {
        value: testUserEmail,
      },
      password: {
        value: "fakeInstructurePassword",
      },
    },
  },
  {
    cipherType: CipherType.Login,
    url: "https://badgr.com/auth/login",
    fields: {
      username: {
        value: testUserEmail,
      },
      password: {
        value: "fakeBadgrPassword",
      },
    },
  },
  {
    cipherType: CipherType.Login,
    url: "https://portfolium.com/login",
    fields: {
      username: {
        value: testUserEmail,
      },
      password: {
        value: "fakePortfoliumPassword",
      },
    },
  },
  {
    cipherType: CipherType.Login,
    url: "https://app.masteryconnect.com/login",
    fields: {
      username: {
        value: testUserEmail,
      },
      password: {
        value: "fakeMasteryPassword",
      },
    },
  },
  {
    cipherType: CipherType.Login,
    url: "https://identity.us2.kimonocloud.com/login",
    fields: {
      username: {
        value: testUserEmail,
      },
      password: {
        value: "fakeElevateDSPassword",
      },
    },
  },
  {
    cipherType: CipherType.Login,
    url: "https://app.learnplatform.com/users/sign_in",
    fields: {
      username: {
        value: testUserEmail,
      },
      password: {
        value: "fakeLearnPlatformPassword",
      },
    },
  },
  {
    cipherType: CipherType.Login,
    url: "https://www.target.com/account",
    fields: {
      username: {
        value: testUserEmail,
      },
      password: {
        value: "fakeTargetPassword",
      },
    },
  },
  {
    cipherType: CipherType.Login,
    url: "https://accounts.craigslist.org/login",
    fields: {
      username: {
        value: testUserEmail,
      },
      password: {
        value: "fakeCraigsListPassword",
      },
    },
  },
  {
    cipherType: CipherType.Login,
    url: "https://www.capitalone.com",
    uriMatchType: UriMatchType.Host,
    fields: {
      username: {
        value: testUserEmail,
      },
      password: {
        value: "fakeCapitalOneWidgetPassword",
      },
    },
  },
  {
    cipherType: CipherType.Login,
    url: "https://verified.capitalone.com/auth/signin",
    uriMatchType: UriMatchType.Host,
    fields: {
      username: {
        value: testUserEmail,
      },
      password: {
        value: "fakeCapitalOnePassword",
      },
    },
  },
  {
    cipherType: CipherType.Login,
    url: "https://www.fedex.com/secure-login",
    fields: {
      username: {
        value: testUserEmail,
      },
      password: {
        value: "fakeFedExPassword",
      },
    },
  },
  {
    cipherType: CipherType.Login,
    url: "https://www.tumblr.com",
    fields: {
      username: {
        value: testUserEmail,
      },
    },
  },
  {
    cipherType: CipherType.Login,
    url: "https://seguro.marca.com/registro/v3/?view=login",
    fields: {
      username: {
        value: testUserEmail,
      },
    },
  },
  {
    cipherType: CipherType.Login,
    url: "https://www.bestbuy.com/identity/global/signin",
    fields: {
      username: {
        value: testUserEmail,
      },
      password: {
        value: "fakeBestBuyPassword",
      },
    },
  },
  {
    cipherType: CipherType.Login,
    url: "https://www.adobe.com",
    fields: {
      username: {
        value: testUserEmail,
      },
    },
  },
  {
    cipherType: CipherType.Login,
    url: "https://auth.hulu.com/web/login",
    fields: {
      username: {
        value: testUserEmail,
      },
      password: {
        value: "fakeHuluPassword",
      },
    },
  },
  {
    cipherType: CipherType.Login,
    url: "https://account.bbc.com/signin",
    fields: {
      username: {
        value: testUserEmail,
      },
      password: {
        value: "fakeBBCPassword",
      },
    },
  },
  {
    cipherType: CipherType.Login,
    url: "https://steamcommunity.com/login/home",
    uriMatchType: UriMatchType.Exact,
    fields: {
      username: {
        value: testUserEmail,
      },
      password: {
        value: "fakeSteamCommunityPassword",
      },
    },
  },
  {
    cipherType: CipherType.Login,
    url: "https://store.steampowered.com/login",
    uriMatchType: UriMatchType.Exact,
    fields: {
      username: {
        value: testUserEmail,
      },
      password: {
        value: "fakeSteamStorePassword",
      },
    },
  },
  {
    cipherType: CipherType.Login,
    url: "https://www.lowes.com/u/login",
    fields: {
      username: {
        value: testUserEmail,
      },
      password: {
        value: "fakeLowesPassword",
      },
    },
  },
  {
    cipherType: CipherType.Login,
    url: "https://login.xfinity.com/login",
    fields: {
      username: {
        value: testUserEmail,
      },
    },
  },
  {
    cipherType: CipherType.Login,
    url: "https://www.bezzypsa.com/signin/SIGNIN",
    fields: {
      username: {
        value: testUserEmail,
      },
      password: {
        value: "fakeBezzyPassword",
      },
    },
  },
  {
    cipherType: CipherType.Login,
    url: "https://www.yelp.com/login",
    fields: {
      username: {
        value: testUserEmail,
      },
      password: {
        value: "fakeYelpPassword",
      },
    },
  },
  {
    cipherType: CipherType.Login,
    url: "https://wordpress.com/log-in",
    fields: {
      username: {
        value: testUserEmail,
      },
    },
  },
  {
    cipherType: CipherType.Login,
    url: "https://nextdoor.com/login",
    fields: {
      username: {
        value: testUserEmail,
      },
      password: {
        value: "fakeNextdoorPassword",
      },
    },
  },
  {
    cipherType: CipherType.Login,
    url: "https://linktr.ee/login",
    fields: {
      username: {
        value: testUserName,
      },
      password: {
        value: "fakeLinktreePassword",
      },
    },
  },
  {
    cipherType: CipherType.Login,
    url: "https://quizlet.com",
    fields: {
      username: {
        value: testUserEmail,
      },
      password: {
        value: "fakeQuizletPassword",
      },
    },
  },
  {
    cipherType: CipherType.Login,
    url: "https://realtor.com",
    fields: {
      username: {
        value: testUserEmail,
      },
      password: {
        value: "fakeRealtorPassword",
      },
    },
  },
  {
    cipherType: CipherType.Login,
    url: "https://www.canva.com",
    fields: {
      username: {
        value: testUserEmail,
      },
    },
  },
  {
    cipherType: CipherType.Login,
    url: "https://www.att.com/acctmgmt/login",
    fields: {
      username: {
        value: testUserEmail,
      },
      password: {
        value: "fakeATTPassword",
      },
    },
  },
  {
    cipherType: CipherType.Login,
    url: "https://auth0.com/api/auth/login",
    additionalLoginUrls: ["https://auth0.auth0.com"],
    uriMatchType: UriMatchType.Host,
    fields: {
      username: {
        value: testUserEmail,
      },
      password: {
        value: "fakeAuth0Password",
      },
    },
  },
  {
    cipherType: CipherType.Login,
    url: "https://www.washingtonpost.com/subscribe/signin",
    fields: {
      username: {
        value: testUserEmail,
      },
    },
  },
  {
    cipherType: CipherType.Login,
    url: "https://login.aol.com",
    fields: {
      username: {
        value: testUserEmail,
      },
    },
  },
  {
    cipherType: CipherType.Login,
    url: "https://www.t-mobile.com",
    fields: {
      username: {
        value: testUserEmail,
      },
    },
  },
  {
    cipherType: CipherType.Login,
    url: "https://login.okta.com/signin",
    fields: {
      username: {
        value: testUserEmail,
      },
      password: {
        value: "fakeOktaSupportPassword",
      },
    },
  },
  {
    cipherType: CipherType.Login,
    url: "https://bethesda.net",
    fields: {
      username: {
        value: testUserEmail,
      },
      password: {
        value: "fakeBethesdaPassword",
      },
    },
  },

  {
    cipherType: CipherType.Login,
    url: "https://www.reddit.com",
    fields: {
      username: {
        value: testUserName,
      },
      password: {
        value: "fakeRedditInlineLoginPassword",
      },
    },
  },
  {
    cipherType: CipherType.Login,
    url: "https://auth.max.com/login",
    fields: {
      username: { value: "maxcom_user" },
      password: { value: "maxcom_password" },
    },
  },
  {
    cipherType: CipherType.Login,
    url: "https://login.clear.com.br",
    fields: {
      username: { value: "12345678901111" },
      password: { value: "098765" },
    },
  },
  {
    cipherType: CipherType.Login,
    url: "https://www.gamespot.com/login-signup",
    fields: {
      username: {
        value: testUserEmail,
      },
      password: {
        value: "fakeGamespotPassword",
      },
    },
  },
  {
    cipherType: CipherType.Login,
    url: "https://temu.com",
    fields: {
      username: {
        value: testUserEmail,
      },
      password: {
        value: "fakeTemuPassword",
      },
    },
  },
  {
    cipherType: CipherType.Login,
    url: "https://www.temu.com/login.html",
    fields: {
      username: {
        value: testUserEmail,
      },
      password: {
        value: "fakeTemuLoginPagePassword",
      },
    },
  },
  {
    cipherType: CipherType.Login,
    url: "https://www.apple.com",
    fields: {
      username: {
        value: testUserEmail,
      },
      password: {
        value: "fakeApplePassword",
      },
    },
  },
  {
    cipherType: CipherType.Login,
    url: "https://www.marvel.com/signin",
    fields: {
      username: {
        value: testUserEmail,
      },
      password: {
        value: "fakeMarvelPassword",
      },
    },
  },
  {
    cipherType: CipherType.Login,
    url: "https://www.espn.com",
    additionalLoginUrls: [
      "https://cdn.registerdisney.go.com/v4/bundle/web/ESPN-ONESITE.WEB",
    ],
    fields: {
      username: {
        value: testUserEmail,
      },
      password: {
        value: "fakeESPNPassword",
      },
    },
  },
];

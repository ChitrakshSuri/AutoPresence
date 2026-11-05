import chrome from "selenium-webdriver/chrome";
import { Builder, WebDriver } from "selenium-webdriver";
import path from "node:path";
import { loginToKeka } from "./login";

export const KEKA_URL = (process.env.KEKA_URL || "").replace(/\/+$/, "");
const MAX_ATTEMPTS = 5;

export const loadKeka = async (): Promise<WebDriver> => {
  if (!KEKA_URL) throw new Error("KEKA_URL is not set in .env");

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const options = new chrome.Options();
    // Persistent profile: Keka remembers this "device" after one manual OTP, and keeps the session.
    const profileDir = path.join(__dirname, "../../.chrome-profile");
    options.addArguments(
      "--deny-permission-prompts",
      "--window-size=1280,900",
      "--no-sandbox", // needed on most Linux servers regardless of headless state
      `--user-data-dir=${profileDir}`
    );
    if (process.env.CHROME_BIN) {
      options.setChromeBinaryPath(process.env.CHROME_BIN);
    }
    if (process.env.HEADLESS === "1") {
      options.addArguments("--headless=new");
    }
    let builder = new Builder().forBrowser("chrome").setChromeOptions(options);
    if (process.env.CHROMEDRIVER_PATH) {
      builder = builder.setChromeService(
        new chrome.ServiceBuilder(process.env.CHROMEDRIVER_PATH)
      );
    }
    const driver = builder.build();

    try {
      await driver.get(`${KEKA_URL}/#/home/dashboard`);
      await loginToKeka(driver);
      return driver;
    } catch (error) {
      console.log(`Login attempt ${attempt}/${MAX_ATTEMPTS} failed:`, (error as Error).message);
      await driver.quit().catch(() => {});
      if ((error as Error).message === "otp-needed-headless") throw error;
      if (attempt === MAX_ATTEMPTS) throw error;
    }
  }
  throw new Error("unreachable");
};

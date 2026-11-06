import chrome from "selenium-webdriver/chrome";
import { Builder, WebDriver } from "selenium-webdriver";
import fs from "node:fs";
import path from "node:path";
import { loginToKeka } from "./login";

export const KEKA_URL = (process.env.KEKA_URL || "").replace(/\/+$/, "");
const MAX_ATTEMPTS = 5;
const PROFILE_DIR = path.join(__dirname, "../../.chrome-profile");

// A SIGKILL'd Chrome (e.g. `systemctl restart` cutting it off mid-run) can leave its
// SingletonLock/SingletonCookie/SingletonSocket files behind in the profile dir, which
// makes the next launch refuse to start ("user data directory is already in use") -
// surfacing as a generic "Server terminated early" crash from chromedriver.
const clearStaleProfileLocks = () => {
  for (const name of ["SingletonLock", "SingletonCookie", "SingletonSocket"]) {
    try {
      fs.rmSync(path.join(PROFILE_DIR, name), { force: true });
    } catch (e) {
      // ignore - profile dir may not exist yet on first run
    }
  }
};

const buildDriver = (): WebDriver => {
  const options = new chrome.Options();
  options.addArguments(
    "--deny-permission-prompts",
    "--window-size=1280,900",
    "--no-sandbox", // needed on most Linux servers regardless of headless state
    "--disable-dev-shm-usage", // avoids crashes on low-memory VMs with tiny /dev/shm
    `--user-data-dir=${PROFILE_DIR}`
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
  return builder.build();
};

export const loadKeka = async (): Promise<WebDriver> => {
  if (!KEKA_URL) throw new Error("KEKA_URL is not set in .env");

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    clearStaleProfileLocks();
    let driver: WebDriver | undefined;
    try {
      // .build() itself can reject (chromedriver/Chrome crashing on launch) - catch that
      // here too, not just the navigation/login below, so it can't become an unhandled
      // rejection that kills the whole process instead of being retried.
      driver = await buildDriver();
      await driver.get(`${KEKA_URL}/#/home/dashboard`);
      await loginToKeka(driver);
      return driver;
    } catch (error) {
      console.log(`Login attempt ${attempt}/${MAX_ATTEMPTS} failed:`, (error as Error).message);
      await driver?.quit().catch(() => {});
      if ((error as Error).message === "otp-needed-headless") throw error;
      if (attempt === MAX_ATTEMPTS) throw error;
    }
  }
  throw new Error("unreachable");
};

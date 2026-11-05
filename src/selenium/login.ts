import { By, WebDriver, until } from "selenium-webdriver";
import { dataURLtoFile } from "../utils/data-to-file";
import { readCaptcha } from "../vision/read-captcha";

const CAPTCHA_FILE = "captcha.png";

// Login = email + password + captcha (no OTP).
export const loginToKeka = async (driver: WebDriver) => {
  // Keka redirects the company URL to its login page when not signed in.
  const base = process.env.KEKA_URL!.replace(/\/+$/, "");
  const PW_BTN = By.xpath('//button[.//p[contains(normalize-space(.), "Continue with Password")]]');
  // Only the logged-in app shows this nav item. The app URL alone isn't proof: Keka's SPA
  // can sit on the app URL for a while (especially on a slow VM) before its own JS checks
  // the session and redirects to login if it isn't valid.
  const LOGGED_IN_MARKER = By.xpath('//a[contains(normalize-space(.), "Attendance")]');

  // Wait for whichever appears first: the "Continue with Password" button, the login form,
  // or a real sign that we're already logged in (saved profile still valid).
  const until40 = Date.now() + 40000;
  while (Date.now() < until40) {
    if ((await driver.findElements(LOGGED_IN_MARKER)).length) {
      console.log("Already logged in (saved session).");
      return;
    }
    const btn = await driver.findElements(PW_BTN);
    if (btn.length) {
      await btn[0].click();
      break;
    }
    if ((await driver.findElements(By.css("input#email"))).length) break;
    await new Promise((r) => setTimeout(r, 500));
  }

  const emailInput = await driver.wait(
    until.elementLocated(By.css("input#email")),
    20000
  );
  const passwordInput = await driver.findElement(By.css("input#password"));
  const captchaImg = await driver.findElement(By.css("img#imgCaptcha"));
  const captchaInput = await driver.findElement(By.css("input#captcha"));

  await emailInput.sendKeys(process.env.KEKA_EMAIL || "");
  await passwordInput.sendKeys(process.env.KEKA_PASSWORD || "");

  const src = await captchaImg.getAttribute("src");
  dataURLtoFile(src, CAPTCHA_FILE);
  const captchaText = await readCaptcha(CAPTCHA_FILE);
  console.log("Captcha read as:", captchaText);
  await captchaInput.sendKeys(captchaText);

  await driver.findElement(By.xpath('//button[normalize-space()="Login"]')).click();

  // Success = we land on the Keka app. Failure = captcha error. Or Keka asks for an email code (new device).
  let otpAnnounced = false;
  const deadline = Date.now() + 40000;
  let limit = deadline;
  while (Date.now() < limit) {
    if ((await driver.findElements(LOGGED_IN_MARKER)).length) return;
    const bad = await driver.findElements(
      By.xpath('//*[contains(text(), "Invalid Captcha")]')
    );
    if (bad.length) throw new Error("captcha-failed");
    const otp = await driver.findElements(By.css("input#code"));
    if (otp.length && !otpAnnounced) {
      if (process.env.HEADLESS === "1") throw new Error("otp-needed-headless");
      otpAnnounced = true;
      limit = Date.now() + 5 * 60000;
      console.log(">>> Keka sent a code to your email. Enter it in the browser window (5 min). Tick 'remember device' if offered.");
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error("login did not complete (wrong password, or an unexpected extra step)");
};

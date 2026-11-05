import { WebDriver, WebElement } from "selenium-webdriver";

// Click robustly: Keka shows floating toasts that can cover buttons.
export const safeClick = async (driver: WebDriver, el: WebElement) => {
  await driver.executeScript(
    "arguments[0].scrollIntoView({block:'center'})",
    el
  );
  try {
    await el.click();
  } catch (e) {
    if ((e as Error).name === "ElementClickInterceptedError") {
      await driver.executeScript("arguments[0].click()", el);
    } else {
      throw e;
    }
  }
};

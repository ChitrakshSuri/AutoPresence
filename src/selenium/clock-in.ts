import { By, WebDriver, until } from "selenium-webdriver";
import { getAttendanceState } from "./state";
import { safeClick } from "./click";
import { KEKA_URL } from "./index";
import { asyncDelay } from "../utils/delay";

export const handleClockIn = async (driver: WebDriver) => {
  await driver.get(`${KEKA_URL}/#/me/attendance/logs`);
  const state = await getAttendanceState(driver);
  if (state === "in") {
    console.log("Already clocked in - nothing to do.");
    return;
  }
  if (state === "skip") {
    return; // getAttendanceState already logged why
  }

  const clockInButton = driver.findElement(
    By.xpath('//a[contains(normalize-space(.), "Web Clock-In")]')
  );
  await safeClick(driver, clockInButton);

  const closeLocationPopupIdentifier = By.xpath(
    "//span[contains(@class, 'ki') and contains(@class ,'ki-close')]"
  );
  try {
    await driver.wait(until.elementLocated(closeLocationPopupIdentifier), 5000);
    await safeClick(driver, driver.findElement(closeLocationPopupIdentifier));
  } catch (e) {
    // popup did not appear (location denied/not requested) - fine
  }

  // wait for the ClockOut button to be visible, which means clocked in successfully
  await driver.wait(
    until.elementLocated(By.xpath('//button[contains(normalize-space(.), "Web Clock-out")]')),
    45000
  );
};

import { By, WebDriver, until } from "selenium-webdriver";
import { getAttendanceState } from "./state";
import { safeClick } from "./click";
import { KEKA_URL } from "./index";

export const handleClockOut = async (driver: WebDriver) => {
  await driver.get(`${KEKA_URL}/#/me/attendance/logs`);
  const state = await getAttendanceState(driver);
  if (state === "out") {
    console.log("Not clocked in (or already clocked out) - nothing to do.");
    return;
  }
  if (state === "skip") {
    return; // getAttendanceState already logged why
  }

  const clockOutButton = driver.findElement(
    By.xpath('//button[contains(normalize-space(.), "Web Clock-out")]')
  );

  await safeClick(driver, clockOutButton);

  await driver.wait(
    until.elementLocated(By.xpath('//button[normalize-space(.)="Clock-out"]')),
    5000
  );
  const finalClockOutButton = driver.findElement(
    By.xpath('//button[normalize-space(.)="Clock-out"]')
  );
  await safeClick(driver, finalClockOutButton);

  const closeLocationPopupIdentifier = By.xpath(
    "//span[contains(@class, 'ki') and contains(@class ,'ki-close')]"
  );
  try {
    await driver.wait(until.elementLocated(closeLocationPopupIdentifier), 5000);
    await safeClick(driver, driver.findElement(closeLocationPopupIdentifier));
  } catch (e) {
    // popup did not appear (location denied/not requested) - fine
  }

  // wait for the ClockIn button to be visible, which means clocked out successfully
  await driver.wait(
    until.elementLocated(By.xpath('//a[contains(normalize-space(.), "Web Clock-In")]')),
    45000
  );
  console.log("====================================");
  console.log("Clocked out Successfully");
  console.log("====================================");
};

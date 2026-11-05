import { By, WebDriver, until } from "selenium-webdriver";

const CLOCK_IN = By.xpath('//a[contains(normalize-space(.), "Web Clock-In")]');
const CLOCK_OUT = By.xpath('//button[contains(normalize-space(.), "Web Clock-out")]');
// Common Keka wording for a non-working day. Not verified against a real leave/holiday
// day yet - if a run skips (or fails to skip) incorrectly, check debug.png/the logged
// page text and tighten this list.
const LEAVE_PHRASES = [
  "on leave",
  "on a leave",
  "leave applied",
  "holiday",
  "week off",
  "weekly off",
  "day off",
  "not a working day",
  "optional holiday",
];

const visible = async (driver: WebDriver, by: By) => {
  for (const el of await driver.findElements(by)) {
    if (await el.isDisplayed().catch(() => false)) return true;
  }
  return false;
};

// Looks only near the attendance widget (not the whole page - the sidebar has a "Leave"
// menu item, which would otherwise always false-match).
const findLeaveOrHolidayText = async (driver: WebDriver): Promise<string | null> => {
  const text: string = ((await driver
    .executeScript(
      `
      const w = document.querySelector('[class*="attendance" i], [class*="clock" i], [class*="widget" i]');
      return (w || document.body).innerText || "";
      `
    )
    .catch(() => "")) as string) || "";
  const lower = text.toLowerCase();
  const hit = LEAVE_PHRASES.find((p) => lower.includes(p));
  return hit ? `matched "${hit}"` : null;
};

// Keka's page first renders a stale/default widget, then updates it. Wait for the widget,
// let it settle, and only trust the state once it is unchanged for several seconds.
export const getAttendanceState = async (
  driver: WebDriver
): Promise<"in" | "out" | "skip"> => {
  const deadline0 = Date.now() + 45000;
  while (Date.now() < deadline0) {
    if (
      (await driver.findElements(CLOCK_IN)).length ||
      (await driver.findElements(CLOCK_OUT)).length
    ) {
      break;
    }
    const leaveHit = await findLeaveOrHolidayText(driver);
    if (leaveHit) {
      console.log(`Looks like a non-working day (${leaveHit}) - skipping.`);
      return "skip";
    }
    await new Promise((r) => setTimeout(r, 500));
  }

  let last = "";
  let stableSince = Date.now();
  const deadline = Date.now() + 45000;
  while (Date.now() < deadline) {
    const isIn = await visible(driver, CLOCK_OUT); // "Web Clock-out" button => clocked in
    const isOut = await visible(driver, CLOCK_IN);
    const cur = isIn && !isOut ? "in" : isOut && !isIn ? "out" : "unknown";
    if (cur !== last) {
      last = cur;
      stableSince = Date.now();
    } else if (cur !== "unknown" && Date.now() - stableSince >= 5000) {
      return cur;
    }
    const leaveHit = await findLeaveOrHolidayText(driver);
    if (leaveHit) {
      console.log(`Looks like a non-working day (${leaveHit}) - skipping.`);
      return "skip";
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error("could not determine attendance state");
};

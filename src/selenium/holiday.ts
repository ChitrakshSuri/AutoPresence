import { By, WebDriver, until } from "selenium-webdriver";
import { MONTHS, todayInIST } from "./date-utils";

type HolidayEntry = { day: number; month: string; name: string; isOptional: boolean };

// Checks Keka's company Holidays list (the modal opened from the Home dashboard's
// "Holidays" card) for a FIXED (non-optional) holiday on today's date. Optional
// holidays are intentionally excluded here - they only count as a day off if the
// employee actually applied leave for them, which isOnApprovedLeaveToday covers.
//
// Markup-based, taken from the real modal HTML, but only verified against the 2026
// calendar it was written against. If this misses or misfires, the logged "Holiday
// list parsed" line shows exactly what it read, which is the first thing to check.
export const isFixedHolidayToday = async (
  driver: WebDriver,
  kekaUrl: string
): Promise<string | null> => {
  await driver.get(`${kekaUrl}/#/home/dashboard`);

  const viewAll = By.xpath(
    '//p[@title="Holidays"]/parent::div//a[contains(normalize-space(.), "View All")]'
  );
  try {
    await driver.wait(until.elementLocated(viewAll), 20000);
    await driver.findElement(viewAll).click();
    await driver.wait(until.elementLocated(By.css("h4")), 10000);
  } catch (e) {
    console.log("Could not open the Holidays list - skipping the fixed-holiday check this run.");
    return null;
  }
  await new Promise((r) => setTimeout(r, 1000)); // let the modal finish rendering all entries

  const { entries, year } = (await driver.executeScript(`
    const yearText = document.querySelector('.mx-4') ? document.querySelector('.mx-4').textContent.trim() : '';
    const year = parseInt(yearText, 10) || new Date().getFullYear();
    const boxes = [...document.querySelectorAll('h4')]
      .map(h4 => h4.closest('.mb-10'))
      .filter(Boolean);
    const seen = new Set();
    const entries = [];
    for (const box of boxes) {
      if (seen.has(box)) continue;
      seen.add(box);
      const day = parseInt((box.querySelector('h4') || {}).textContent || '', 10);
      const month = ((box.querySelector('p.text-uppercase') || {}).textContent || '').trim();
      const nameEl = box.querySelector('.ml-16 p');
      const name = nameEl ? nameEl.textContent.trim() : '';
      const isOptional = !!box.querySelector('[title="Optional Holiday"]');
      if (!isNaN(day) && month) entries.push({ day, month, name, isOptional });
    }
    return { entries, year };
  `)) as { entries: HolidayEntry[]; year: number };

  console.log("Holiday list parsed:", JSON.stringify(entries));

  const today = todayInIST();
  for (const e of entries) {
    const month = MONTHS[e.month.toLowerCase()];
    if (month === today.m && e.day === today.d && year === today.y && !e.isOptional) {
      return `"${e.name}" is a company holiday today`;
    }
  }
  return null;
};

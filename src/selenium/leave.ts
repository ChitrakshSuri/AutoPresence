import { By, WebDriver, until } from "selenium-webdriver";
import { MONTHS, todayInIST } from "./date-utils";

const parseKekaDate = (raw: string): { y: number; m: number; d: number } | null => {
  const cleaned = raw.replace(/\(.*?\)/g, "").trim(); // strip "(Second half)" etc.
  const match = cleaned.match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/);
  if (!match) return null;
  const month = MONTHS[match[2].toLowerCase()];
  if (!month) return null;
  return { y: parseInt(match[3], 10), m: month, d: parseInt(match[1], 10) };
};

type LeaveRow = { date: string; status: string };

// Checks Keka's Leave History grid (an ag-grid table) for an Approved entry covering
// today. Selectors were taken from the real page markup (col-id="leaveDates" /
// col-id="status" cells), so this should be reliable for this Keka tenant.
//
// Known limitation: only scans the first page of results. If there are more than ~5
// future-dated approved leaves ahead of today's entry in the list (sorted newest-first),
// this could miss it. Unlikely for normal usage, but worth knowing if it ever misfires.
export const isOnApprovedLeaveToday = async (
  driver: WebDriver,
  kekaUrl: string
): Promise<string | null> => {
  await driver.get(`${kekaUrl}/#/me/leave/summary`);
  try {
    await driver.wait(until.elementLocated(By.css(".ag-row")), 30000);
  } catch (e) {
    // No rows at all (empty leave history) is possible - fall through with an empty scrape
    // rather than throwing, since that's a legitimate "no leave today" outcome too.
  }
  await new Promise((r) => setTimeout(r, 1000)); // let all rows finish rendering, not just the first

  const rows = (await driver.executeScript(`
    return [...document.querySelectorAll('.ag-row')].map(row => {
      const dateCell = row.querySelector('[col-id="leaveDates"] p');
      const statusCell = row.querySelector('[col-id="status"] p');
      return {
        date: dateCell ? dateCell.textContent.trim() : '',
        status: statusCell ? statusCell.textContent.trim() : '',
      };
    });
  `)) as LeaveRow[];

  const { y, m, d } = todayInIST();
  for (const row of rows) {
    const parsed = parseKekaDate(row.date);
    if (!parsed) continue;
    if (parsed.y === y && parsed.m === m && parsed.d === d && /approved/i.test(row.status)) {
      return `"${row.date.trim()}" is Approved on the Leave History page`;
    }
  }
  return null;
};

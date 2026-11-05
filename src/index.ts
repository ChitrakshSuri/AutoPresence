import "dotenv/config";
import fs from "node:fs";
import cron from "node-cron";
import { DateTime } from "luxon";
import { WebDriver } from "selenium-webdriver";
import { loadKeka, KEKA_URL } from "./selenium";
import { handleClockIn } from "./selenium/clock-in";
import { handleClockOut } from "./selenium/clock-out";
import { isOnApprovedLeaveToday } from "./selenium/leave";
import { isFixedHolidayToday } from "./selenium/holiday";
import { asyncDelay } from "./utils/delay";

const TZ = "Asia/Kolkata";
const MIN = 60_000;

// Cron fires at the START of the window; a random delay spreads it across the window.
const JOBS = {
  in: { cron: "20 9 * * 1-5", windowMin: 10, label: "Clock-In 🕘", run: handleClockIn }, // 09:20-09:30
  out: { cron: "30 18 * * 1-5", windowMin: 15, label: "Clock-Out 🕕", run: handleClockOut }, // 18:30-18:45
};

const stamp = () => DateTime.now().setZone(TZ).toLocaleString(DateTime.DATETIME_MED);

const dumpDebug = async (driver: WebDriver) => {
  try {
    fs.writeFileSync("debug.png", await driver.takeScreenshot(), "base64");
    const texts = await driver.executeScript<string[]>(
      "return [...document.querySelectorAll('button,a')].map(e=>e.tagName+': '+e.innerText.trim()).filter(t=>t.length>6&&t.length<60)"
    );
    console.log("URL:", await driver.getCurrentUrl());
    console.log("Buttons/links on page:\n" + [...new Set(texts)].join("\n"));
    console.log("Saved screenshot to debug.png");
  } catch (e) {}
};

const perform = async (kind: "in" | "out", delayMs: number) => {
  const job = JOBS[kind];
  let driver: WebDriver | undefined;
  try {
    console.log(`[${stamp()}] ${job.label} scheduled in ${(delayMs / MIN).toFixed(1)} min`);
    await asyncDelay(delayMs);
    driver = await loadKeka();

    const leaveReason =
      (await isOnApprovedLeaveToday(driver, KEKA_URL)) ||
      (await isFixedHolidayToday(driver, KEKA_URL));
    if (leaveReason) {
      console.log(`⏭️ Skipping ${job.label} at ${stamp()} - ${leaveReason}.`);
      return;
    }

    await job.run(driver);
    console.log(`✅ ${job.label} successful at ${stamp()}`);
  } catch (error) {
    console.error(`❌ ${job.label} FAILED at ${stamp()}`, error);
    if (driver) await dumpDebug(driver);
  } finally {
    await driver?.quit().catch(() => {});
  }
};

const nowIdx = process.argv.indexOf("--now");
if (nowIdx !== -1) {
  // One-shot test: `yarn now:in` / `yarn now:out` (no delay, no cron)
  const kind = process.argv[nowIdx + 1] as "in" | "out";
  if (kind !== "in" && kind !== "out") {
    console.error("Usage: --now in|out");
    process.exit(1);
  }
  perform(kind, 0).then(() => process.exit(0));
} else {
  for (const kind of ["in", "out"] as const) {
    const job = JOBS[kind];
    cron.schedule(
      job.cron,
      () => perform(kind, Math.floor(Math.random() * job.windowMin * MIN)),
      { timezone: TZ }
    );
  }
  console.log(`AutoPresence running. Clock-in 09:20-09:30, clock-out 18:30-18:45 (${TZ}), Mon-Fri.`);
}

# AutoPresence

Automates Keka web clock-in / clock-out, Monday to Friday, IST. Runs headless on a
small always-on server, with no manual attention day to day.

## What it does

- **Logs in** with email + password + a captcha, read locally with Tesseract OCR (no
  OTP in this flow, no cloud dependency, no Google Cloud account needed).
- **Reuses a saved browser session**, so Keka doesn't ask for a device-verification
  email code on every run - only the first time, or if that session ever expires.
- **Clocks in** at a random time between 09:20-09:30, **clocks out** between
  18:30-18:45. The randomness avoids hitting the exact same second every day.
- **Skips itself automatically** when it shouldn't run at all:
  - You already clocked in/out manually.
  - You have an approved leave or approved optional holiday for today (read live
    from Keka's own Leave History page).
  - Today is a fixed company holiday (read live from Keka's Holidays calendar) -
    optional holidays don't count here unless you've applied leave for them.
- **Never gets stuck**: every step has a timeout and a retry; a genuinely broken run
  (e.g. captcha misread 5 times in a row, or a surprise "enter code" screen while
  running headless) fails that one run cleanly instead of hanging.

## How it's deployed

Running on an Oracle Cloud "Always Free" VM (`VM.Standard.E2.1.Micro`, 1 GB RAM + a
2 GB swap file, Ubuntu 22.04), managed by a `systemd` service (`autopresence.service`)
so it survives reboots and restarts itself if it ever crashes.

A separate, small script runs **on your own laptop** (not the server) via a
`systemd --user` timer, checking the server's logs shortly after each clock
window closes (09:50 and 18:50 IST) and showing a desktop notification for
anything that happened - success, a skip (leave/holiday), or a failure. If your
laptop is asleep at that time, it catches up as soon as you wake it. No Slack, no
email - just a local popup.

## Setup (fresh machine - server or otherwise)

1. Node 18+, Chrome or Chromium, and `tesseract-ocr` installed.
2. `npm install`
3. `cp .env.example .env` and fill in `KEKA_EMAIL`, `KEKA_PASSWORD`, `KEKA_URL`
   (your company's Keka subdomain, no trailing slash).
4. On a headless Linux server (not your own desktop), also set in `.env`:
   ```
   CHROME_BIN=/usr/bin/chromium-browser
   CHROMEDRIVER_PATH=/usr/bin/chromedriver
   ```
5. **First login needs a visible browser**, because Keka will likely show a
   one-time "enter the code we emailed you" screen for a brand-new browser
   profile. On a desktop, just run `npm run now:in` with `HEADLESS=0` and handle
   it in the window that opens. On a headless server, start a virtual display,
   point Chrome at it, and view it over VNC for that one step:
   ```bash
   sudo apt install -y xvfb x11vnc
   Xvfb :99 -screen 0 1280x900x24 &
   x11vnc -display :99 -nopw -forever -shared -listen localhost -rfbport 5900 &
   # from your own machine: ssh -L 5900:localhost:5900 <server>
   # then open localhost:5900 in a VNC client (e.g. Remmina) and:
   DISPLAY=:99 npm run now:in
   ```
   Once logged in, kill `Xvfb`/`x11vnc` - they're only needed for that one step.
   The session is saved in `.chrome-profile/` and reused from then on.
6. Set `HEADLESS=1` in `.env` and confirm it still works with no display:
   `unset DISPLAY && npm run now:out` (only run this if you're fine being
   clocked out right now).

## Running on a schedule

`npm start` runs the built-in scheduler (clock-in/out windows + the leave/holiday
checks) and must stay running. On a server, use `systemd`:

```ini
# /etc/systemd/system/autopresence.service
[Unit]
Description=AutoPresence - Keka clock in/out automation
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=<your-user>
WorkingDirectory=/home/<your-user>/AutoPresence
ExecStart=/usr/bin/npm start
Restart=on-failure
RestartSec=30

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now autopresence
journalctl -u autopresence -f   # watch it live
```

## Manual testing

- `npm run now:in` / `npm run now:out` - runs once immediately, no delay, no cron.
  Useful for testing, but remember it will actually clock you in/out for real.

## Known limitations

- The saved login session can expire (password change, Keka security policy,
  etc.). If it does, a scheduled headless run fails with `otp-needed-headless`
  instead of hanging - re-run the one-time visible-login step above to fix it.
- The leave/holiday skip checks read Keka's live pages with hand-written
  selectors (not an official API), verified against this tenant's markup at the
  time this was built. If Keka changes that page layout, the checks could stop
  matching - the logged "Holiday list parsed" / Leave History output shows
  exactly what was read, which is the first thing to check if a skip doesn't fire.
- The Leave History check only looks at the first page of results (5 rows); if
  you stack more than ~5 future approved leaves ahead of today's in that list,
  it could be missed.

## Disclaimer

Built for personal, educational use. Make sure automating attendance is allowed
by your employer's policy before relying on it.

import { execFileSync } from "node:child_process";

// Captcha is a short string of letters/digits. Read locally with Tesseract - free, no
// cloud account needed.
export const readCaptcha = async (fileName: string): Promise<string> => {
  // psm 7 = single line of text; whitelist = letters+digits
  const raw = execFileSync(
    "tesseract",
    [fileName, "stdout", "--psm", "7", "-c",
     "tessedit_char_whitelist=ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"],
    { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }
  );
  const text = raw.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  if (!text) throw new Error("captcha-failed");
  return text;
};

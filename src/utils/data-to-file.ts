import fs from "node:fs";

export function dataURLtoFile(dataurl: string, filename: string) {
  const base64 = dataurl.split(",").pop() as string;
  fs.writeFileSync(filename, base64, { encoding: "base64" });
}

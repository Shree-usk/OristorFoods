import { execSync } from "node:child_process";

export default function setup() {
  execSync("npx prisma db push", {
    stdio: "inherit",
  });
}

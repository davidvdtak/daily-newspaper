import { register } from "rmapi-js";

const code = process.argv[2];
if (!code) {
  console.error("Usage: node register-device.mjs YOUR_8_CHARACTER_CODE");
  process.exit(1);
}
const token = await register(code);
console.log(JSON.stringify({ token }, null, 2));

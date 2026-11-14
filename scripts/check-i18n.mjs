import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const localesDir = path.resolve(__dirname, "../src/i18n/locales");

/**
 * Recursively collects all dot-separated keys from a nested JSON object.
 */
function collectKeys(obj, prefix = "") {
  const keys = [];
  for (const [k, v] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${k}` : k;
    if (v !== null && typeof v === "object" && !Array.isArray(v)) {
      keys.push(...collectKeys(v, fullKey));
    } else {
      keys.push(fullKey);
    }
  }
  return keys.sort();
}

const files = fs
  .readdirSync(localesDir)
  .filter((f) => f.endsWith(".json"))
  .sort();

if (!files.includes("en.json")) {
  console.error("Error: Reference locale en.json is missing.");
  process.exit(1);
}

const refContent = JSON.parse(
  fs.readFileSync(path.join(localesDir, "en.json"), "utf8")
);
const refKeys = collectKeys(refContent);

let hasErrors = false;

for (const file of files) {
  if (file === "en.json") continue;
  const content = JSON.parse(
    fs.readFileSync(path.join(localesDir, file), "utf8")
  );
  const localeKeys = collectKeys(content);

  const missing = refKeys.filter((k) => !localeKeys.includes(k));
  const extra = localeKeys.filter((k) => !refKeys.includes(k));

  if (missing.length > 0 || extra.length > 0) {
    hasErrors = true;
    console.error(`\nLocale mismatch in ${file}:`);
    if (missing.length > 0) {
      console.error(`  Missing keys (${missing.length}):`, missing.join(", "));
    }
    if (extra.length > 0) {
      console.error(`  Extra keys (${extra.length}):`, extra.join(", "));
    }
  } else {
    console.log(`✓ ${file}: ${localeKeys.length} keys match en.json (100% parity)`);
  }
}

if (hasErrors) {
  process.exit(1);
}
console.log(`\nAll ${files.length} locale files passed key parity check (${refKeys.length} keys each).`);

import { access } from "node:fs/promises";

// Static assets are maintained directly in public; Pages compiles functions separately.
await Promise.all(
  [
    "public/index.html",
    "public/styles.css",
    "public/index.js",
    "functions/api/send-email.js",
  ].map((path) => access(path)),
);
console.log("Pages static assets ready: public/");

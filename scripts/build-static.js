const fs = require("fs");
const path = require("path");

const projectRoot = path.resolve(__dirname, "..");
const outputDirectory = path.join(projectRoot, "dist");
const publicFiles = ["index.html", "gracias.html", "styles.css", "script.js"];

fs.rmSync(outputDirectory, { recursive: true, force: true });
fs.mkdirSync(outputDirectory, { recursive: true });

for (const filename of publicFiles) {
  fs.copyFileSync(
    path.join(projectRoot, filename),
    path.join(outputDirectory, filename),
  );
}

fs.cpSync(path.join(projectRoot, "assets"), path.join(outputDirectory, "assets"), {
  recursive: true,
});

console.log("Archivos públicos preparados en dist/.");

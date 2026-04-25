#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import readline from "node:readline";
import sharp from "sharp";

const ROOT = process.cwd();
const DEFAULT_FOLDER = path.join(ROOT, "public", "SIGLE");
const SUPPORTED_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp"]);
const OUTPUT_SUFFIX = ".transparent.png";

function parseArgs(argv) {
  const args = {
    folder: DEFAULT_FOLDER,
    file: "",
    threshold: 28,
    feather: 24,
    overwrite: false,
    help: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = argv[i + 1];

    if (arg === "--help" || arg === "-h") args.help = true;
    else if (arg === "--overwrite" || arg === "-y") args.overwrite = true;
    else if (arg === "--folder" && next) {
      args.folder = path.resolve(ROOT, next);
      i += 1;
    } else if (arg === "--file" && next) {
      args.file = next;
      i += 1;
    } else if (arg === "--threshold" && next) {
      args.threshold = Number(next);
      i += 1;
    } else if (arg === "--feather" && next) {
      args.feather = Number(next);
      i += 1;
    } else if (!arg.startsWith("-") && !args.file) {
      args.file = arg;
    }
  }

  if (!Number.isFinite(args.threshold) || args.threshold < 0 || args.threshold > 255) {
    throw new Error("--threshold trebuie sa fie un numar intre 0 si 255.");
  }

  if (!Number.isFinite(args.feather) || args.feather < 0 || args.feather > 255) {
    throw new Error("--feather trebuie sa fie un numar intre 0 si 255.");
  }

  return args;
}

function printHelp() {
  console.log(`
Conversie sigla cu fundal transparent pentru PDF-uri.

Utilizare:
  npm run sigla:transparent
  npm run sigla:transparent -- --file "IPJ SIBIU.jpeg"
  npm run sigla:transparent -- --file "IPJ SIBIU.jpeg" --threshold 32 --feather 20

Optiuni:
  --folder <path>       Folderul cu imagini. Implicit: public/SIGLE
  --file <nume|path>    Imaginea de procesat. Daca lipseste, apare selectorul din terminal.
  --threshold <0-255>   Cat de aproape de fundal devine complet transparent. Implicit: 28
  --feather <0-255>     Zona de tranzitie pentru margini anti-aliased. Implicit: 24
  --overwrite, -y       Suprascrie output-ul daca exista deja.
`);
}

async function listImages(folder) {
  const entries = await fs.readdir(folder, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .filter((name) => SUPPORTED_EXTENSIONS.has(path.extname(name).toLowerCase()))
    .filter((name) => !name.toLowerCase().endsWith(OUTPUT_SUFFIX))
    .sort((a, b) => a.localeCompare(b, "ro"));
}

function resolveInputPath(folder, file) {
  if (!file) return "";
  const direct = path.isAbsolute(file) ? file : path.join(folder, file);
  return direct;
}

function outputPathFor(inputPath) {
  const ext = path.extname(inputPath);
  const base = inputPath.slice(0, -ext.length);
  return `${base}${OUTPUT_SUFFIX}`;
}

function renderMenu(files, selected, numericBuffer) {
  process.stdout.write("\x1b[2J\x1b[H");
  console.log("Selecteaza imaginea pentru conversie transparenta:");
  console.log("Foloseste sagetile sus/jos si Enter. Poti apasa si numarul imaginii.\n");

  files.forEach((file, index) => {
    const marker = index === selected ? ">" : " ";
    console.log(`${marker} ${String(index + 1).padStart(2, " ")}. ${file}`);
  });

  if (numericBuffer) {
    console.log(`\nNumar introdus: ${numericBuffer}`);
  }
}

async function selectFile(files) {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    throw new Error("Nu pot deschide selectorul interactiv intr-un terminal non-TTY. Foloseste --file.");
  }

  readline.emitKeypressEvents(process.stdin);
  process.stdin.setRawMode(true);

  let selected = 0;
  let numericBuffer = "";
  renderMenu(files, selected, numericBuffer);

  return new Promise((resolve, reject) => {
    const cleanup = () => {
      process.stdin.setRawMode(false);
      process.stdin.off("keypress", onKeypress);
      process.stdout.write("\n");
    };

    const onKeypress = (_str, key) => {
      try {
        if (key.ctrl && key.name === "c") {
          cleanup();
          reject(new Error("Anulat de utilizator."));
          return;
        }

        if (key.name === "up") {
          selected = selected === 0 ? files.length - 1 : selected - 1;
          numericBuffer = "";
          renderMenu(files, selected, numericBuffer);
          return;
        }

        if (key.name === "down") {
          selected = selected === files.length - 1 ? 0 : selected + 1;
          numericBuffer = "";
          renderMenu(files, selected, numericBuffer);
          return;
        }

        if (/^[0-9]$/.test(key.sequence || "")) {
          numericBuffer += key.sequence;
          const numericSelection = Number(numericBuffer);
          if (numericSelection >= 1 && numericSelection <= files.length) {
            selected = numericSelection - 1;
          }
          renderMenu(files, selected, numericBuffer);
          return;
        }

        if (key.name === "backspace") {
          numericBuffer = numericBuffer.slice(0, -1);
          renderMenu(files, selected, numericBuffer);
          return;
        }

        if (key.name === "return" || key.name === "enter") {
          const numericSelection = Number(numericBuffer);
          if (numericBuffer && (numericSelection < 1 || numericSelection > files.length)) {
            numericBuffer = "";
            renderMenu(files, selected, numericBuffer);
            return;
          }

          cleanup();
          resolve(files[selected]);
        }
      } catch (error) {
        cleanup();
        reject(error);
      }
    };

    process.stdin.on("keypress", onKeypress);
  });
}

async function promptOverwrite(outputPath) {
  if (!process.stdin.isTTY || !process.stdout.isTTY) return false;

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(`Fisierul exista deja: ${path.relative(ROOT, outputPath)}. Suprascrii? [y/N] `, (answer) => {
      rl.close();
      resolve(["y", "yes", "da", "d"].includes(answer.trim().toLowerCase()));
    });
  });
}

function colorDistance(pixel, background) {
  const dr = pixel[0] - background[0];
  const dg = pixel[1] - background[1];
  const db = pixel[2] - background[2];
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

function sampleBackground(data, width, height, channels) {
  const sampleSize = Math.max(3, Math.min(12, Math.floor(Math.min(width, height) * 0.04)));
  const sums = [0, 0, 0];
  let count = 0;

  const corners = [
    [0, 0],
    [width - sampleSize, 0],
    [0, height - sampleSize],
    [width - sampleSize, height - sampleSize],
  ];

  for (const [startX, startY] of corners) {
    for (let y = startY; y < startY + sampleSize; y += 1) {
      for (let x = startX; x < startX + sampleSize; x += 1) {
        const index = (y * width + x) * channels;
        sums[0] += data[index];
        sums[1] += data[index + 1];
        sums[2] += data[index + 2];
        count += 1;
      }
    }
  }

  return sums.map((value) => Math.round(value / count));
}

function removeConnectedBackground({ data, width, height, channels, background, threshold, feather }) {
  const pixels = width * height;
  const visited = new Uint8Array(pixels);
  const queue = new Int32Array(pixels);
  const maxDistance = threshold + feather;
  let head = 0;
  let tail = 0;
  let transparentPixels = 0;
  let softPixels = 0;

  const enqueueIfBackground = (pixelIndex) => {
    if (visited[pixelIndex]) return;
    const dataIndex = pixelIndex * channels;
    const distance = colorDistance(
      [data[dataIndex], data[dataIndex + 1], data[dataIndex + 2]],
      background,
    );

    if (distance > maxDistance) return;
    visited[pixelIndex] = 1;
    queue[tail] = pixelIndex;
    tail += 1;
  };

  for (let x = 0; x < width; x += 1) {
    enqueueIfBackground(x);
    enqueueIfBackground((height - 1) * width + x);
  }

  for (let y = 1; y < height - 1; y += 1) {
    enqueueIfBackground(y * width);
    enqueueIfBackground(y * width + width - 1);
  }

  while (head < tail) {
    const pixelIndex = queue[head];
    head += 1;

    const x = pixelIndex % width;
    const y = Math.floor(pixelIndex / width);

    if (x > 0) enqueueIfBackground(pixelIndex - 1);
    if (x < width - 1) enqueueIfBackground(pixelIndex + 1);
    if (y > 0) enqueueIfBackground(pixelIndex - width);
    if (y < height - 1) enqueueIfBackground(pixelIndex + width);
  }

  for (let pixelIndex = 0; pixelIndex < pixels; pixelIndex += 1) {
    if (!visited[pixelIndex]) continue;

    const dataIndex = pixelIndex * channels;
    const distance = colorDistance(
      [data[dataIndex], data[dataIndex + 1], data[dataIndex + 2]],
      background,
    );

    let alpha = 0;
    if (distance > threshold && feather > 0) {
      alpha = Math.round(255 * Math.min(1, (distance - threshold) / feather));
      softPixels += 1;
    } else {
      transparentPixels += 1;
    }

    data[dataIndex + 3] = alpha;
  }

  return { visitedPixels: tail, transparentPixels, softPixels };
}

async function convertImage({ inputPath, outputPath, threshold, feather }) {
  const image = sharp(inputPath).ensureAlpha();
  const { data, info } = await image.raw().toBuffer({ resolveWithObject: true });
  const background = sampleBackground(data, info.width, info.height, info.channels);
  const stats = removeConnectedBackground({
    data,
    width: info.width,
    height: info.height,
    channels: info.channels,
    background,
    threshold,
    feather,
  });

  await sharp(data, {
    raw: {
      width: info.width,
      height: info.height,
      channels: info.channels,
    },
  })
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toFile(outputPath);

  return { background, stats, width: info.width, height: info.height };
}

async function assertHasAlpha(filePath) {
  const metadata = await sharp(filePath).metadata();
  if (!metadata.hasAlpha) {
    throw new Error(`Output-ul nu are canal alpha: ${filePath}`);
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }

  const files = await listImages(args.folder);
  if (!files.length) {
    throw new Error(`Nu am gasit imagini suportate in ${path.relative(ROOT, args.folder)}.`);
  }

  const selectedFile = args.file || await selectFile(files);
  const inputPath = resolveInputPath(args.folder, selectedFile);
  const inputExt = path.extname(inputPath).toLowerCase();

  if (!SUPPORTED_EXTENSIONS.has(inputExt)) {
    throw new Error(`Format nesuportat: ${inputExt}. Foloseste jpg, jpeg, png sau webp.`);
  }

  await fs.access(inputPath);

  const outputPath = outputPathFor(inputPath);
  const exists = await fs.access(outputPath).then(() => true).catch(() => false);
  if (exists && !args.overwrite) {
    const shouldOverwrite = await promptOverwrite(outputPath);
    if (!shouldOverwrite) {
      console.log("Conversie anulata. Originalul a ramas neatins.");
      return;
    }
  }

  const result = await convertImage({
    inputPath,
    outputPath,
    threshold: args.threshold,
    feather: args.feather,
  });
  await assertHasAlpha(outputPath);

  console.log("Conversie finalizata.");
  console.log(`Input:  ${path.relative(ROOT, inputPath)}`);
  console.log(`Output: ${path.relative(ROOT, outputPath)}`);
  console.log(`Dimensiune: ${result.width}x${result.height}`);
  console.log(`Fundal detectat RGB: ${result.background.join(", ")}`);
  console.log(`Pixeli fundal gasiti: ${result.stats.visitedPixels}`);
  console.log(`Pixeli transparenti: ${result.stats.transparentPixels}`);
  console.log(`Pixeli margine semi-transparenta: ${result.stats.softPixels}`);
}

main().catch((error) => {
  console.error(`Eroare: ${error.message}`);
  process.exitCode = 1;
});

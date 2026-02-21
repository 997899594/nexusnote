#!/usr/bin/env node

/**
 * PWA Icon Generation Script
 *
 * 生成不同尺寸的 PWA 图标
 * 需要安装 sharp: pnpm add -D sharp
 */

const sharp = require("sharp");
const path = require("node:path");
const fs = require("node:fs");

const SVG_PATH = path.join(__dirname, "../../public/icon.svg");
const OUTPUT_DIR = path.join(__dirname, "../../public");

const SIZES = [192, 512];

async function generateIcons() {
  if (!fs.existsSync(SVG_PATH)) {
    console.error("❌ icon.svg not found, skipping icon generation");
    console.log("   Please ensure icon.svg exists in public/");
    return;
  }

  console.log("🎨 Generating PWA icons...");

  for (const size of SIZES) {
    const outputFile = path.join(OUTPUT_DIR, `icon-${size}.png`);

    try {
      await sharp(SVG_PATH)
        .resize(size, size, {
          fit: "contain",
          background: { r: 0, g: 0, b: 0, alpha: 0 },
        })
        .png()
        .toFile(outputFile);

      console.log(`✅ Generated ${outputFile}`);
    } catch (error) {
      console.error(`❌ Failed to generate ${outputFile}:`, error.message);
    }
  }

  console.log("🎉 Icon generation complete!");
}

generateIcons().catch(console.error);

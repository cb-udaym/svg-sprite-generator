// build-icons.js
// Usage: npm run build-icons.js
const fs = require('fs-extra');
const path = require('path');
const fg = require('fast-glob');
const { optimize } = require('svgo');
const { execSync } = require("child_process");
const Sprite = require('svg-sprite');
const sharp = require("sharp");

const INPUT_DIR = path.join(__dirname, 'icons'); // your source icons
const TEMP_DIR = path.join(__dirname, 'temp-optimized');
const OUT_DIR = path.join(__dirname, 'sprite');
const OUT_FILE = path.join(OUT_DIR, 'sprite.svg');
const JSON_OUT_DIR = path.join(__dirname, 'sprite');         // keep alongside sprite.svg
const JSON_OUT_FILE = path.join(JSON_OUT_DIR, 'icons.json'); // sprite/icons.json
const CONFIG_DIR = path.join(__dirname, "config");

const SKIP_OPT_FILE = path.join(CONFIG_DIR, "skip-optimize.json");
const META_FILE = path.join(CONFIG_DIR, "icon-meta.json");

const EXPORT_DIR = path.join(OUT_DIR, "exports"); // sprite/exports
const PNG_DIR = path.join(EXPORT_DIR, "png");     // sprite/exports/png
const PDF_DIR = path.join(EXPORT_DIR, "pdf");     // sprite/exports/pdf


function loadSkipList() {
  try {
    const list = fs.readJsonSync(SKIP_OPT_FILE);
    return new Set(list.map(s => s.toLowerCase()));
  } catch {
    return new Set();
  }
}

function loadSkipColorSet() {
  try {
    const list = fs.readJsonSync(SKIP_OPT_FILE);
    return new Set(list.map(f => f.replace(/\.svg$/i, "").toLowerCase()));
  } catch {
    return new Set();
  }
}

function loadMeta() {
  try {
    return fs.readJsonSync(META_FILE);
  } catch {
    return {};
  }
}

function getBaseSize(metaEntry) {
  const bs = metaEntry?.baseSize;

  if (Array.isArray(bs) && bs.length === 2) {
    return [Number(bs[0]), Number(bs[1])];
  }

  if (typeof bs === "number") {
    return [bs, bs];
  }

  return [24, 24];
}


async function generatePngExports() {
  const files = await fg("**/*.svg", { cwd: INPUT_DIR, dot: false });
  const meta = loadMeta();

  await fs.remove(PNG_DIR);
  await fs.ensureDir(PNG_DIR);

  for (const rel of files) {
    const name = iconNameFromRelPath(rel);
    const m = meta[name] || {};
    const [baseW, baseH] = getBaseSize(m);


    // Optional: only generate for icons that support iOS
    const platforms = Array.isArray(m.platforms) ? m.platforms : ["web"];
    if (!platforms.includes("ios")) continue;

    const abs = path.join(INPUT_DIR, rel);
    const svg = await fs.readFile(abs);

    for (const scale of [1, 2, 3]) {
      const out = path.join(PNG_DIR, `${name}@${scale}x.png`);
      await sharp(svg)
        .resize(baseW * scale, baseH * scale)
        .png()
        .toFile(out);
    }
  }

  console.log("✅ PNG exports written to", PNG_DIR);
}

async function generatePdfExports() {
  const files = await fg("**/*.svg", { cwd: INPUT_DIR, dot: false });
  const meta = loadMeta();

  await fs.remove(PDF_DIR);
  await fs.ensureDir(PDF_DIR);

  for (const rel of files) {
    const name = iconNameFromRelPath(rel);
    const m = meta[name] || {};

    // Optional: only generate for icons that support iOS
    const platforms = Array.isArray(m.platforms) ? m.platforms : ["web"];
    if (!platforms.includes("ios")) continue;

    const abs = path.join(INPUT_DIR, rel);
    const out = path.join(PDF_DIR, `${name}.pdf`);

    try {
      execSync(`inkscape "${abs}" --export-type=pdf --export-filename="${out}"`, {
        stdio: "ignore"
      });
    } catch (err) {
      console.warn("⚠️ PDF export failed:", rel);
    }
  }

  console.log("✅ PDF exports written to", PDF_DIR);
}


function assertUniqueNames(files) {
  const seen = new Map();
  const dupes = [];

  for (const rel of files) {
    const name = iconNameFromRelPath(rel).toLowerCase();
    if (seen.has(name)) {
      dupes.push({ name, a: seen.get(name), b: rel });
    } else {
      seen.set(name, rel);
    }
  }

  if (dupes.length) {
    console.error("\n❌ Duplicate icon names found:\n");
    dupes.forEach(d => {
      console.error(`- ${d.name}`);
      console.error(`  1) ${d.a}`);
      console.error(`  2) ${d.b}\n`);
    });
    process.exit(1);
  }
}

function assertKebabLowercase(files) {
  const bad = [];

  for (const rel of files) {
    const base = path.basename(rel, ".svg");
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(base)) bad.push(rel);
  }

  if (bad.length) {
    console.error("\n❌ Invalid file names (must be lowercase kebab-case):\n");
    bad.forEach(f => console.error(`- ${f}`));
    console.error("\n✅ Example: arrow-drop-down.svg\n");
    process.exit(1);
  }
}

function getAddedMeta(absPath) {
  try {
    // Get oldest commit date/time for file (first introduction)
    // %aI gives strict ISO 8601 (includes time + timezone)
    const cmd = `git log --diff-filter=A --follow --format=%aI -- "${absPath}" | tail -n 1`;
    const iso = execSync(cmd, { stdio: ["ignore", "pipe", "ignore"] })
      .toString()
      .trim();

    if (iso) {
      const ts = new Date(iso).getTime();          // epoch ms
      const date = iso.slice(0, 10);               // YYYY-MM-DD
      return { addedDate: date, addedTs: ts };
    }
  } catch {}

  // fallback to file mtime
  const stat = fs.statSync(absPath);
  const ts = stat.mtime.getTime();
  const date = new Date(ts).toISOString().slice(0, 10);
  return { addedDate: date, addedTs: ts };
}

// If you want icon names to include folders: "actions/close".
// If you want flat names only: "close".
function iconNameFromRelPath(rel) {
  // preserve folders, drop extension, normalize slashes
  return rel.replace(/\\/g, "/").replace(/\.svg$/i, "");
}

async function generateIconsJson() {
  // find all svg files in original INPUT_DIR (not temp)
  const files = await fg('**/*.svg', { cwd: INPUT_DIR, dot: false });
  assertUniqueNames(files);
  assertKebabLowercase(files);
  const meta = loadMeta();


   const icons = files.map((rel) => {
    const abs = path.join(INPUT_DIR, rel);
    const name = iconNameFromRelPath(rel); // e.g. "close" or "actions/close"
    const m = meta[name] || {};
    const platforms = Array.isArray(m.platforms) ? m.platforms : (m.platforms ? [m.platforms] : ["default"]);  // ✅ default
    const { addedDate, addedTs } = getAddedMeta(abs);

    return {
      name,
      file: rel.replace(/\\/g, "/"), // relative path within INPUT_DIR
      svgPath: `icons/${rel.replace(/\\/g, "/")}`,
      platforms,
      addedDate: addedDate, // YYYY-MM-DD,
      addedTs: addedTs,     // epoch ms for sorting

      // merged meta (normalize to always-array)
      oldClasses: Array.isArray(m.oldClasses)
        ? m.oldClasses
        : (m.oldClasses ? [m.oldClasses] : []),

      colors: Array.isArray(m.colors)
        ? m.colors.map(c => typeof c === "string" ? ({ value: c }) : c)
        : [],
      
      keywords: Array.isArray(m.keywords)
        ? m.keywords
        : (m.keywords ? [m.keywords] : []),

      note: m.note || null,
      category: m.category || null
    };
  })
.sort((a, b) => b.addedTs - a.addedTs || a.name.localeCompare(b.name));


  await fs.ensureDir(JSON_OUT_DIR);
  await fs.writeJson(JSON_OUT_FILE, {
    generatedAt: new Date().toISOString(),
    inputDir: "icons",
    spritePath: "sprite/sprite.svg",
    icons
  }, { spaces: 2 });

  console.log('✅ icons.json written to', JSON_OUT_FILE);
}


// SVGO config (minimal; you can add/remove plugins you want)
const svgoConfig = {
  multipass: true,
  plugins: [
    'cleanupAttrs',
    'removeDoctype',
    'removeComments',
    'removeMetadata',
    'removeTitle',
    'removeDesc',
    'convertPathData',
    'removeUselessDefs',
    'sortAttrs',
    'removeDimensions',
    // note: we deliberately don't add a converter plugin here; we'll do targeted replace later
  ]
};

// helper: run svgo optimize on string
function svgoOptimize(svgString, filePath) {
  const res = optimize(svgString, { path: filePath, ...svgoConfig });
  if (res.error) throw new Error(res.error);
  return res.data;
}

async function optimizeAll() {
  await fs.remove(TEMP_DIR);
  await fs.ensureDir(TEMP_DIR);

  const skipSet = loadSkipList();

  // find all svg files in icons folder (recursive)
  const files = await fg('**/*.svg', { cwd: INPUT_DIR, dot: false });

  for (const rel of files) {
    const srcPath = path.join(INPUT_DIR, rel);
    const outPath = path.join(TEMP_DIR, rel);
    await fs.ensureDir(path.dirname(outPath));
    const svg = await fs.readFile(srcPath, 'utf8');

    const shouldSkip = skipSet.has(path.basename(rel).toLowerCase());

    if (shouldSkip) {
      // Copy as-is (no optimization)
      await fs.writeFile(outPath, svg, "utf8");
      console.log(`⏭️  Skipped optimization: ${rel}`);
    } else {
      // Optimize normally
      const optimized = svgoOptimize(svg, srcPath);
      await fs.writeFile(outPath, optimized, 'utf8');
    }
  }
}

async function createSprite() {
  // svg-sprite config: symbol mode, and disable built-in shape transforms
  const config = {
    mode: {
      symbol: {
        dest: '.',
        sprite: path.basename(OUT_FILE)
      }
    },
    shape: {
      transform: [] // IMPORTANT: don't let sprite tool re-run transforms
    },
    svg: {
      xmlDeclaration: false,
      doctypeDeclaration: false
    }
  };

  const spriter = new Sprite(config);

  // add optimized files
  const files = await fg('**/*.svg', { cwd: TEMP_DIR });
  const meta = loadMeta(); // ✅ read config meta once
  for (const rel of files) {

      const name = iconNameFromRelPath(rel);
      const m = meta[name] || {};
      const platforms = Array.isArray(m.platforms)
        ? m.platforms
        : (m.platforms ? [m.platforms] : ["default"]);

      if (!platforms.includes("web")) {
        console.log(`🚫 Skipping non-web icon from sprite: ${rel}`);
        continue;
      }

    const filePath = path.join(TEMP_DIR, rel);
    const contents = await fs.readFile(filePath, 'utf8');
    // second param is name, we provide rel so ids can be based on path if you want
    spriter.add(path.resolve(filePath), rel, contents);
  }

  await fs.ensureDir(OUT_DIR);

  return new Promise((resolve, reject) => {
    spriter.compile((err, result) => {
      if (err) return reject(err);
      // result.symbol.sprite.contents is a Buffer
      const spriteContents = result.symbol.sprite.contents.toString('utf8');
      fs.writeFile(OUT_FILE, spriteContents).then(resolve).catch(reject);
    });
  });
}

// Post-process sprite.svg to convert only specific fills/strokes to currentColor,
// but preserve contents inside <mask>...</mask>
function replaceColorsOutsideMasks(spriteSvg) {
    const skipColorSet = loadSkipColorSet();

  // 1) extract mask blocks and replace with placeholders
  const maskRegex = /<mask\b[\s\S]*?<\/mask>/gi;
  const masks = [];
  const placeholder = '___SVG_MASK_PLACEHOLDER___';

  let spriteWithPlaceholders = spriteSvg.replace(maskRegex, (m) => {
    masks.push(m);
    return `${placeholder}${masks.length - 1}___`; // unique placeholder index
  });

  // 2) replace targeted fill/stroke values outside masks
  // This will only replace black values and common black forms
  // adjust the regex if you want to include more colors

    // Process each symbol separately
  spriteWithPlaceholders = spriteWithPlaceholders.replace(
    /<symbol\b[^>]*\bid="([^"]+)"[^>]*>[\s\S]*?<\/symbol>/gi,
    (symbolBlock, id) => {
      const idLower = id.toLowerCase();

      // if in skip set -> return unchanged symbol block
      if (skipColorSet.has(idLower)) return symbolBlock;

      // else apply currentColor replacement only inside this symbol
      return symbolBlock
        .replace(/fill="(#000000|#000|black)"/gi, 'fill="currentColor"')
        .replace(/stroke="(#000000|#000|black)"/gi, 'stroke="currentColor"');
    }
  );

  // 3) restore mask blocks back
  // placeholder pattern: ___SVG_MASK_PLACEHOLDER___<index>___
  spriteWithPlaceholders = spriteWithPlaceholders.replace(
    /___SVG_MASK_PLACEHOLDER___(\d+)___/g,
    (_, idx) => masks[Number(idx)] || ''
  );

  return spriteWithPlaceholders;
}

async function postProcessSprite() {
  let svg = await fs.readFile(OUT_FILE, 'utf8');
  const newSvg = replaceColorsOutsideMasks(svg);
  await fs.writeFile(OUT_FILE, newSvg, 'utf8');
}

async function run() {
  try {
    console.log('Optimizing SVGs...');
    await optimizeAll();
    console.log('Creating sprite...');
    await createSprite();
    console.log('Post-processing sprite (preserve mask contents)...');
    await postProcessSprite();
    await fs.remove(TEMP_DIR);

    console.log('Generating icons.json...');
    await generateIconsJson();
    console.log('✅ Sprite written to', OUT_FILE);
    
    console.log("Generating PNG exports...");
    await generatePngExports();

    console.log("Generating PDF exports...");
    await generatePdfExports();

  } catch (err) {
    console.error('Error building sprite:', err);
    process.exitCode = 1;
  }
}

run();

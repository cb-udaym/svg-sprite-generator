// build-sprite.js
// Usage: node build-sprite.js
const fs = require('fs-extra');
const path = require('path');
const fg = require('fast-glob');
const { optimize } = require('svgo');
const { execSync } = require("child_process");
const Sprite = require('svg-sprite');

const INPUT_DIR = path.join(__dirname, 'icons'); // your source icons (can have subfolders)
const TEMP_DIR = path.join(__dirname, 'temp-optimized');
const OUT_DIR = path.join(__dirname, 'sprite');
const OUT_FILE = path.join(OUT_DIR, 'sprite.svg');
const JSON_OUT_DIR = path.join(__dirname, 'sprite');         // keep alongside sprite.svg
const JSON_OUT_FILE = path.join(JSON_OUT_DIR, 'icons.json'); // sprite/icons.json


// Prefer git “first added” date. Falls back to filesystem mtime.
function getAddedDate(absPath) {
  try {
    const cmd = `git log --diff-filter=A --follow --format=%ad --date=short -- "${absPath}" | tail -n 1`;
    const out = execSync(cmd, { stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
    if (out) return out; // YYYY-MM-DD
  } catch {}
  const stat = fs.statSync(absPath);
  return new Date(stat.mtime).toISOString().slice(0, 10);
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

  const icons = files.map((rel) => {
    const abs = path.join(INPUT_DIR, rel);
    return {
      name: iconNameFromRelPath(rel), // e.g. "close" or "actions/close"
      file: rel.replace(/\\/g, "/"),  // relative path within INPUT_DIR
      addedDate: getAddedDate(abs)    // YYYY-MM-DD
    };
  })
  .sort((a, b) => b.addedDate.localeCompare(a.addedDate) || a.name.localeCompare(b.name));

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

  // find all svg files in icons folder (recursive)
  const files = await fg('**/*.svg', { cwd: INPUT_DIR, dot: false });

  for (const rel of files) {
    const srcPath = path.join(INPUT_DIR, rel);
    const outPath = path.join(TEMP_DIR, rel);
    await fs.ensureDir(path.dirname(outPath));
    const svg = await fs.readFile(srcPath, 'utf8');
    const optimized = svgoOptimize(svg, srcPath);
    await fs.writeFile(outPath, optimized, 'utf8');
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
  for (const rel of files) {
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
  spriteWithPlaceholders = spriteWithPlaceholders
    // fill="#000" | fill="#000000" | fill="black" (case-insensitive)
    .replace(/fill="(#000000|#000|black)"/gi, 'fill="currentColor"')
    // stroke similarly
    .replace(/stroke="(#000000|#000|black)"/gi, 'stroke="currentColor"');

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
  } catch (err) {
    console.error('Error building sprite:', err);
    process.exitCode = 1;
  }
}

run();

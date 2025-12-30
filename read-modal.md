1. **For Web Developers:**
    - Download the latest sprite file
    - ?v or any param.. can be used incase cache needs to be rebuilt. (Refer sample below)
    - #icon-name can be used to select any icon in within the sprite.  (Refer sample below)
    - This site will keep updating as we add new icons
    - Sample usage of SVG sprite:
```
<svg class="sprite-icon">
    <use href="/sprite.svg?v=12#arrow-drop-down"></use>
</svg>

<style>
  .sprite-icon {
    width: 24px;
    height: 24px;
    color: #00B48A;
    display: inline-block;
  }
</style>
```
2. **For Designers:**
   - Add icons in 24x24 so that consistency is maintained.
   - Add 4px padding within the viewBox, so that consistency is maintained. Example icon sizes within viewBox: 20x20, 15x20, 20x14.
   - All icons should be monochrome and black.
   - Some complex icons like google logo, playstore badge etc. may not follow the above mentioned guidelines. Optimisation for these icons can be skipped by placing their file names in `config/skip-optimize.json`
   - Use simple file names (e.g., `search.svg`, `home.svg`, `send-horizontal.svg`).
   - Follow this guide for naming convention: [Lucide icons guidelines](https://lucide.dev/guide/design/icon-design-guide#naming-conventions).
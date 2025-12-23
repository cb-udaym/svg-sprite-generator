## Guidelines for SVG sprites [Internal Tool]

1. This repo optimises the individual SVG icons and reduces the sizes using svgo. Then it changes all black colors to 'currentColor', so that it can be modified later via css. It then creates the svg sprite.
2. **For Web Developers:**
    - The file in the `sprite/` folder will always be the latest sprite.
        - Only the final file `sprite/sprite.svg` is needed for development on the website.
    - ?v or any param.. can be used incase cache needs to be rebuilt. (Refer sample below)
    - #icon-name can be used to select any icon in within the sprite.  (Refer sample below)
    - Individual files' names and previews are available in the `icons/` folder. The same is also available in this [githib pages link](https://cb-udaym.github.io/svg-sprite-generator/).
    - This repo will keep updating as we add new icons.
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
3. **For Designers:**
   - Place raw SVGs in the `icons/` folder.  
   - Add icons in 24x24 so that consistency is maintained.
   - Add 4px padding within the viewBox, so that consistency is maintained. Example icon sizes within viewBox: 20x20, 15x20, 20x14.
   - All icons should be monochrome and black.
   - Use simple file names (e.g., `search.svg`, `home.svg`, `send-horizontal.svg`).
   - Follow this guide for naming convention: [Lucide icons guidelines](https://lucide.dev/guide/design/icon-design-guide#naming-conventions).
5. **For repo maintainer:** 
   - To generate a fresh sprite after adding new icons and to run on local machine:
```
npm run build-icons
npx serve .
```
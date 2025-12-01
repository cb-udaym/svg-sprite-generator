## Design guidelines for SVG sprites

1. For Designers: 
   - Place raw SVGs in the `icons/` folder.  
   - Use simple file names (e.g., `search.svg`, `home.svg`, `send-horizontal.svg`).
   - Add icons in 24x24 so that consistency is maintained
   - Add 4px padding within the viewBox, so that consistency is maintained. ex icons within viewBox: 20x20, 15x20, 20x14
   - All icons should be monochrome and black
   - Follow this guide for naming convention: [Lucide icons guidelines](https://lucide.dev/guide/design/icon-design-guide#naming-conventions) 
2. For Developers:
   - The file in the `sprite/` folder will always be the latest sprite
   - Individual files' names and previews are available in the `icons/` folder
   - Only the final file `sprite/sprite.svg` is needed for development on the website
3. This repo optimises the SVGs' sizes using svgo, then changes all black colors to 'currentColor', so that it can be modified later via css. It then creates the svg sprite.
4. Run:

```bash
npm run build-icons
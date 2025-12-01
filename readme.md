## Adding Icons

1. For Designers: 
   - Place raw SVGs in the `icons/` folder.  
   - Use simple file names (e.g., `search.svg`, `home.svg`, `send-horizontal.svg`).
   - Add icons in 24x24 so that consistency is maintained
   - Add 4px padding within the viewBox, so that consistency is maintained. ex icons within viewBox: 20x20, 15x20, 20x14
   - All icons should be monochrome and black
   - Follow this guide for naming convention: [Lucide icons guidelines](https://lucide.dev/guide/design/icon-design-guide#naming-conventions) 
2. This script optimises the SVG size using svgo, then changes all black colors to 'currentColor', so that it can be modified later via css.
3. Run:

```bash
npm run build-icons
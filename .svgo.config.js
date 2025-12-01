
const forceCurrentColor = {
  name: 'forceCurrentColor',
  type: 'visitor',
  fn: (ast) => {
    return {
      element: {
        enter: (node) => {
          if (!node.attributes) return;

          // fill
          if (node.attributes.fill && node.attributes.fill !== 'none') {
            node.attributes.fill = 'currentColor';
          }

          // stroke
          if (node.attributes.stroke && node.attributes.stroke !== 'none') {
            node.attributes.stroke = 'currentColor';
          }
        }
      }
    };
  }
};

module.exports = {
  multipass: true,
  plugins: [
    // your plugins ...
    'removeDimensions',
    'cleanupAttrs',
    'convertColors',
    'removeDoctype',
    'removeComments',
    'removeMetadata',
    'removeTitle',
    'removeDesc',
    'convertPathData',
    'removeUselessDefs',
    'sortAttrs',
    // forceCurrentColor
  ]
};


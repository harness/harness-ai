const { join } = require('path');
const postcssImport = require('postcss-import');
const tailwindcss = require('tailwindcss');
const autoprefixer = require('autoprefixer');

module.exports = {
  plugins: [
    postcssImport({
      resolve: (id, basedir) => {
        try {
          return require.resolve(id, { paths: [basedir || process.cwd()] });
        } catch {
          try {
            return require.resolve(`${id}.css`, { paths: [basedir || process.cwd()] });
          } catch {
            throw new Error(`Failed to resolve "${id}" from "${basedir || process.cwd()}"`);
          }
        }
      },
    }),
    tailwindcss({
      config: join(__dirname, 'tailwind.config.cjs'),
    }),
    autoprefixer(),
  ],
};

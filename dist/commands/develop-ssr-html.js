"use strict";

const webpack = require(`webpack`);
const fs = require(`fs`);
const webpackConfig = require(`../utils/webpack.config`);
const { store } = require(`../redux`);
const { createErrorFromString } = require(`gatsby-cli/lib/reporter/errors`);

const debug = require(`debug`)(`gatsby:html`);

module.exports = async program => {
  const { directory } = program;

  debug(`generating static HTML`);
  // Reduce pages objects to an array of paths.
  const pages = store.getState().pages.map(page => page.path);

  const serverConfig = await webpackConfig(program, directory, `develop-ssr-html`, null, pages);

  const config = serverConfig.resolve();

  return new Promise((resolve, reject) => {
    const compiler = webpack(config);
    compiler.run((e, stats) => {
      if (e) {
        return reject(e);
      }
      const outputFile = `${config.output.path}/${config.output.filename}`;
      if (stats.hasErrors()) {
        const webpackErrors = stats.compilation.errors.filter(e => e);
        return reject(createErrorFromString(String(webpackErrors[0]), `${outputFile}.map`));
      }

      return resolve({
        compiler,
        requireRenderer: () => new Promise((resolve, reject) => {
          try {
            resolve(require(outputFile));
          } catch (err) {
            reject(err);
          }
        }),
        clearCache: () => Object.keys(require.cache).map(id => {
          if (id === outputFile) {
            delete require.cache[id];
          }
        })
      });
    });
  });
};
//# sourceMappingURL=develop-ssr-html.js.map
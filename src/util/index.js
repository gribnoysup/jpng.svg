/* global assert */

const path = require('path');

const fs = require('fs-extra');
const globCB = require('glob');
const sizeOf = require('image-size');

const ora = require('ora');

const noop = () => {};

const logger = options => ({
  log: options.quiet
    ? noop
    : (message, newLine = true) => {
        if (message) console.log(message);
        if (newLine) console.log();
      },
  start: options.quiet
    ? () => ({ start: noop, succeed: noop, fail: noop })
    : options => ora(options).start(),
});

const chained = promises =>
  promises.reduce((chain, promise) => chain.then(promise), Promise.resolve());

const makeDir = path => fs.mkdirp(path);

const getFileName = filePath => path.basename(filePath, path.extname(filePath));

const readFile = filePath => fs.readFile(filePath);

const writeFile = (filePath, data, options) => fs.writeFile(filePath, data, options);

const glob = (path, options = {}) =>
  new Promise((resolve, reject) =>
    globCB(path, options, (err, result) => (err ? reject(err) : resolve(result)))
  );

const getImageInfo = path => fs.stat(path).then(stat => Object.assign(sizeOf(path), stat));

const getTotalSize = paths =>
  Promise.all(paths.map(path => fs.stat(path))).then(stats => stats.reduce((acc, stat) => acc + stat.size, 0));

module.exports = {
  logger,
  chained,
  glob,
  getFileName,
  getImageInfo,
  getTotalSize,
  makeDir,
  readFile,
  writeFile,
};

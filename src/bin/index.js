#!/usr/bin/env node

const minimist = require('minimist');

const pb = require('pretty-bytes');
const chalk = require('chalk');

const { logger: Logger, chained, glob, getTotalSize } = require('../util');

const JPNG = require('../index');

const argv = minimist(process.argv.slice(2), {
  default: {
    // --- output dir
    output: 'dist',
    // --- output JPEG quality
    bufsize: 4096,
    progressive: false,
    quality: 75,
    // --- inline images as base64,
    inline: false,
    quiet: false,
    help: false,
  },
  alias: {
    o: 'output',
    b: 'bufsize',
    p: 'progressive',
    q: 'quality',
    i: 'inline',
    Q: 'quiet',
    h: 'help',
  },
});

const help = () => {
  console.log('Usage:');
  console.log();
  console.log('jpng.svg <glob> [options]');
  console.log();
  console.log('Options:');
  console.log();
  console.log('  -o, --output <folder>  dist    Output folder');
  console.log('  -b, --bufsize <n>      4096    JPEG compression buffer size');
  console.log('  -p, --progressive      false   Progressive JPEG compression');
  console.log('  -q, --quality <n>      75      JPEG compression quality');
  console.log('  -i, --inline           false   Inline images into SVG file');
  console.log('  -Q, --quiet            false   Do not log the progress');
  console.log();
};

if (argv.help) {
  help();
  process.exit(); // eslint-disable-line
}

const logger = Logger(argv);

const convert = (path, options) =>
  new Promise((resolve, reject) => {
    let svgPath, files, stat;
    logger.log(chalk.underline(path), false);

    const converter = new JPNG(options);
    const spinner = logger.start('Starting');

    converter
      .create(path, options)
      .on('get-stat.start', () => {
        spinner.text = 'Getting image stat';
      })
      .on('create-canvas.start', () => {
        spinner.text = 'Creating canvas';
      })
      .on('get-stat.end', imgStat => {
        stat = imgStat;
      })
      .on('separate-alpha-layer.start', () => {
        spinner.text = 'Separating alpha layer';
      })
      .on('get-image.start', () => {
        spinner.text = 'Creating images';
      })
      .on('get-image.end', imgFiles => {
        files = imgFiles;
      })
      .on('write-result.start', () => {
        spinner.text = 'Writing result';
      })
      .on('write-result.end', svg => {
        svgPath = svg;
      })
      .on('create.end', () => {
        const originalSize = stat.size;
        const resultFiles = [svgPath].concat(options.inline ? [] : files);

        getTotalSize(resultFiles).then(resultSize => {
          const diff = resultSize - originalSize;

          const diffColor = diff <= 0 ? chalk.green : chalk.red;
          const diffTxt = chalk.bold(diffColor(diff > 0 ? '+' + pb(diff) : pb(diff)));

          spinner.succeed(`${pb(originalSize)} -> ${pb(resultSize)} (${diffTxt})`);
          logger.log();

          resolve({ path, options, resultSize, originalSize, diffSize: diff });
        });
      })
      .on('error', err => {
        spinner.fail(chalk.red('Failed'));
        logger.log();

        reject(err);
      });
  });

const main = options => {
  const globPattern = options._[0];

  if (!globPattern) {
    logger.log(chalk.yellow('No glob pattern provided, nothing to convert.'));
    help();

    process.exit(); // eslint-disable-line
  }

  return glob(globPattern)
    .then(files => {
      if (files.length === 0) {
        logger.log('No files found');

        process.exit();
      }

      logger.log(`Found ${chalk.bold(files.length)} image(s):`);
      return chained(files.map(file => () => convert(file, options)));
    })
    .catch(err => {
      logger.log(chalk.red(err.message));
      if (err.stack) logger.log(chalk.red(err.stack));
    });
};

main(argv);

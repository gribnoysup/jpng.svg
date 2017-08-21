#!/usr/bin/env node

const IMAGE_JPEG = 'image/jpeg';
const IMAGE_PNG = 'image/png';

const fs = require('fs-extra');
const path = require('path');
const glob = require('glob');

const minimist = require('minimist');

const prettyBytes = require('pretty-bytes');
const chalk = require('chalk');
const ora = require('ora');

const printLine = (options = {}, text = '') => {
  if (options.quiet === true) return;
  console.log(text);
};

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

  process.exit();
};

if (argv.help) {
  help();
}

const Canvas = require('canvas');
const sizeOf = require('image-size');

const chained = promises =>
  promises.reduce((chain, promise) => chain.then(promise), Promise.resolve());

const createSVGFromTemplate = (filename, width, height, image, mask) => `
  <svg preserveAspectRatio="xMinYMin" version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${width} ${height}">
    <defs>
      <mask id="${filename}-mask">
        <image width="${width}" height="${height}" xlink:href="${mask}"></image>
      </mask>
    </defs>
    <image mask="url(#${filename}-mask)" id="${filename}" width="${width}" height="${height}" xlink:href="${image}"></image>
  </svg>
`;

const getFileName = filePath => path.basename(filePath, path.extname(filePath));

const readFileAsync = filePath => fs.readFile(filePath);

const writeFileAsync = (filePath, data, options) => fs.writeFile(filePath, data, options);

const globAsync = (path, options = {}) =>
  new Promise((resolve, reject) =>
    glob(path, options, (err, result) => (err ? reject(err) : resolve(result)))
  );

const getRGBA = (array, startPos) => ({
  r: array[startPos],
  g: array[startPos + 1],
  b: array[startPos + 2],
  a: array[startPos + 3],
});

const setRGBA = (array, startPos, { r, g, b, a }) => {
  array[startPos] = r;
  array[startPos + 1] = g;
  array[startPos + 2] = b;
  array[startPos + 3] = a;
};

const getDataUrlFromCanvas = (canvas, context, type, imageData, options = {}) => {
  context.putImageData(imageData, 0, 0);
  return new Promise((resolve, reject) => {
    if (type === IMAGE_JPEG) {
      canvas.toDataURL(IMAGE_JPEG, options, (err, jpeg) => (err ? reject(err) : resolve(jpeg)));
    }

    if (type === IMAGE_PNG) {
      canvas.toDataURL(IMAGE_PNG, (err, png) => (err ? reject(err) : resolve(png)));
    }
  });
};

const saveStream = (streamName, canvas, context, imageData = null, options = {}) =>
  new Promise((resolve, reject) => {
    const { path: outPath } = options;

    if (imageData !== null) {
      context.putImageData(imageData, 0, 0);
    }

    if (!outPath) {
      throw new Error('No out path provided for image');
    }

    const outStream = fs.createWriteStream(outPath);
    const inStream = canvas[streamName](options);

    inStream
      .on('data', chunk => outStream.write(chunk))
      .on('error', error => {
        outStream.destroy();
        reject(error);
      })
      .on('end', () => resolve(outPath));
  });

const saveJPG = (canvas, context, imageData = null, options = {}) =>
  saveStream('jpegStream', canvas, context, imageData, options);

const savePNG = (canvas, context, imageData = null, options = {}) =>
  saveStream('pngStream', canvas, context, imageData, options);

const getImageFromBuffer = buffer => {
  const image = new Canvas.Image();
  image.src = buffer;

  return image;
};

const getImageInfo = path => {
  return Object.assign(sizeOf(path), { size: fs.statSync(path).size });
};

const getFilesSize = paths => {
  return Promise.all(paths.map(path => fs.stat(path))).then(stats =>
    stats.reduce((acc, stat) => acc + stat.size, 0)
  );
};

const getImageFromContext = (context, width, height) => context.getImageData(0, 0, width, height);

const getAlphaMaskFromContext = (context, width, height) => {
  const image = getImageFromContext(context, width, height);
  const alphaMask = context.createImageData(width, height);

  for (let i = 0, len = image.data.length; i < len; i += 4) {
    // eslint-disable-next-line
    const { r, g, b, a } = getRGBA(image.data, i);
    setRGBA(alphaMask.data, i, { r: a, g: a, b: a, a: 255 });
  }

  return alphaMask;
};

const createSVG = (filePath, options) => {
  const { output, bufsize, progressive, quality, inline } = options;
  const { width, height, size: originalSize } = getImageInfo(filePath);

  const jpegOptions = {
    bufsize,
    progressive,
    quality,
  };

  const fileName = getFileName(filePath);

  printLine(options, chalk.underline(path.resolve(filePath)));

  const spinner = !options.quiet && ora({ text: `Making canvas` }).start();

  const imageCanvas = new Canvas(width, height);
  const imageContext = imageCanvas.getContext('2d', { pixelFormat: 'RGBA32' });

  const alphaCanvas = new Canvas(width, height);
  const alphaContext = alphaCanvas.getContext('2d', { pixelFormat: 'RGBA32' });

  return fs
    .mkdirp(output)
    .then(() => {
      spinner.text = `Reading file`;
      return readFileAsync(filePath);
    })
    .then(getImageFromBuffer)
    .then(image => {
      spinner.text = `Separating image to layers`;
      imageContext.drawImage(image, 0, 0, width, height);

      return Promise.all([
        getImageFromContext(imageContext, width, height),
        getAlphaMaskFromContext(imageContext, width, height),
      ]);
    })
    .then(images => {
      if (!options.quiet) {
        spinner.text = `Converting canvas to images`;
      }

      const [imageData, alphaMaskData] = images;

      if (inline === true) {
        return Promise.all([
          getDataUrlFromCanvas(imageCanvas, imageContext, IMAGE_JPEG, imageData, jpegOptions),
          getDataUrlFromCanvas(alphaCanvas, alphaContext, IMAGE_PNG, alphaMaskData),
        ]);
      }

      return Promise.all([
        saveJPG(
          imageCanvas,
          imageContext,
          imageData,
          Object.assign({ path: path.join(output, fileName + '.jpg') }, jpegOptions)
        ),
        savePNG(alphaCanvas, alphaContext, alphaMaskData, {
          path: path.join(output, fileName + '-alpha.png'),
        }),
      ]);
    })
    .then(images => {
      if (!options.quiet) {
        spinner.text = `Writing file(s)`;
      }
      const [image, alphaMask] = images;
      const svg = createSVGFromTemplate(fileName, width, height, image, alphaMask);

      return writeFileAsync(path.join(output, fileName + '.svg'), svg, 'utf-8');
    })
    .then(() => {
      if (inline) {
        return getFilesSize([path.join(output, fileName + '.svg')]);
      }

      return getFilesSize([
        path.join(output, fileName + '.svg'),
        path.join(output, fileName + '.jpg'),
        path.join(output, fileName + '-alpha.png'),
      ]);
    })
    .then(totalSize => {
      const diff = totalSize - originalSize;
      if (!options.quiet) {
        spinner.succeed(
          `Done ${prettyBytes(originalSize)} -> ${prettyBytes(totalSize)} (${diff >= 0
            ? chalk.red(prettyBytes(diff))
            : chalk.green(prettyBytes(diff))})`
        );
      }
      printLine(options);
    })
    .catch(err => {
      if (!options.quiet) {
        spinner.fail(err);
      }
      printLine(options);
    });
};

const main = options => {
  const globPattern = options._[0];
  if (!globPattern) return Promise.resolve();

  return globAsync(globPattern)
    .then(files => {
      printLine(options, `Found ${chalk.bold(files.length)} image(s):`);
      printLine(options);

      return files;
    })
    .then(files => chained(files.map(fileName => () => createSVG(fileName, options))));
};

main(argv);

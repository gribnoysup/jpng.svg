const fs = require('fs-extra');
const Canvas = require('canvas');

const IMAGE_JPEG = 'image/jpeg';
const IMAGE_PNG = 'image/png';

const STREAM_JPEG = 'jpegStream';
const STREAM_PNG = 'pngStream';

const createImage = buffer => {
  const image = new Canvas.Image();
  if (buffer) image.src = buffer;

  return image;
};

const createCanvas = (width, height) => {
  const canvas = new Canvas(width, height);
  const context = canvas.getContext('2d', { pixelFormat: 'RGBA32' });

  return { canvas, context };
};

const getImage = (streamName, canvas, context, imageData, options = {}) => {
  context.putImageData(imageData, 0, 0);

  const stream = canvas[streamName](options);
  let data = '';

  return new Promise((resolve, reject) => {
    stream.on('data', chunk => (data += chunk)).on('error', reject).on('end', () => resolve(data));
  });
};

const getJPEG = (canvas, context, imageData, options = {}) =>
  getImage(STREAM_JPEG, canvas, context, imageData, options);

const getPNG = (canvas, context, imageData, options = {}) =>
  getImage(STREAM_PNG, canvas, context, imageData, options);

const saveImage = (streamName, outputPath, canvas, context, imageData = null, options = {}) =>
  new Promise((resolve, reject) => {
    context.putImageData(imageData, 0, 0);

    const outStream = fs.createWriteStream(outputPath);
    const inStream = canvas[streamName](options);

    inStream
      .on('data', chunk => outStream.write(chunk))
      .on('error', error => {
        outStream.destroy();
        reject(error);
      })
      .on('end', () => resolve(outputPath));
  });

const saveJPEG = (outputPath, canvas, context, imageData = null, options = {}) =>
  saveImage(STREAM_JPEG, outputPath, canvas, context, imageData, options);

const savePNG = (outputPath, canvas, context, imageData = null, options = {}) =>
  saveImage(STREAM_PNG, outputPath, canvas, context, imageData, options);

const getDataUrl = (type, canvas, context, imageData, options = {}) => {
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

const getJPEGDataUrl = (canvas, context, imageData, options = {}) =>
  getDataUrl(IMAGE_JPEG, canvas, context, imageData, options);

const getPNGDataUrl = (canvas, context, imageData) =>
  getDataUrl(IMAGE_PNG, canvas, context, imageData);

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

const getImageData = (context, width, height) => context.getImageData(0, 0, width, height);

const getAlphaMaskImageData = (context, width, height) => {
  const image = getImageData(context, width, height);
  const alphaMask = context.createImageData(width, height);

  for (let i = 0, len = image.data.length; i < len; i += 4) {
    // eslint-disable-next-line
    const { r, g, b, a } = getRGBA(image.data, i);
    setRGBA(alphaMask.data, i, { r: a, g: a, b: a, a: 255 });
  }

  return alphaMask;
};

module.exports = {
  getJPEG,
  saveJPEG,
  getPNG,
  savePNG,
  getJPEGDataUrl,
  getPNGDataUrl,
  createImage,
  createCanvas,
  setRGBA,
  getRGBA,
  getImageData,
  getAlphaMaskImageData,
};

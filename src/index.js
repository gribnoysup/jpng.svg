// TODO: mask must be optional depending on image

const EventEmitter = require('events');
const path = require('path');

const { getFileName, getImageInfo, makeDir, readFile, writeFile } = require('./util');

const {
  saveJPEG,
  savePNG,
  getJPEGDataUrl,
  getPNGDataUrl,
  createImage,
  createCanvas,
  getImageData,
  getAlphaMaskImageData,
} = require('./canvas');

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

class JPNG extends EventEmitter {
  constructor(options) {
    super();
    this.options = options;
    this.create = this.create.bind(this);
  }

  create(filePath, options = this.options) {
    this.emit('create.start');
    this.emit('get-stat.start');

    const { output, bufsize, progressive, quality, inline } =
      options === this.options ? options : Object.assign({}, this.options, options);

    const jpegOptions = {
      bufsize,
      progressive,
      quality,
    };

    const fileName = getFileName(filePath);

    getImageInfo(filePath)
      .then(imageInfo => {
        const { width, height } = imageInfo;

        this.emit('get-stat.end', imageInfo);
        this.emit('create-canvas.start');

        const { canvas: imageCanvas, context: imageContext } = createCanvas(width, height);
        const { canvas: alphaCanvas, context: alphaContext } = createCanvas(width, height);

        this.emit('create-canvas.end');
        this.emit('make-dir.start');

        return makeDir(output)
          .then(() => {
            this.emit('make-dir.end');
            this.emit('read-file.start');

            return readFile(filePath);
          })
          .then(buffer => {
            this.emit('read-file.end');
            this.emit('get-image.start');

            return createImage(buffer);
          })
          .then(image => {
            this.emit('get-image.end');
            this.emit('separate-alpha-layer.start');

            imageContext.drawImage(image, 0, 0, width, height);

            return Promise.all([
              getImageData(imageContext, width, height),
              getAlphaMaskImageData(imageContext, width, height),
            ]);
          })
          .then(results => {
            this.emit('separate-alpha-layer.end');
            this.emit('get-image.start');

            const [imageData, alphaMaskImageData] = results;

            if (inline === true) {
              return Promise.all([
                getJPEGDataUrl(imageCanvas, imageContext, imageData, jpegOptions),
                getPNGDataUrl(alphaCanvas, alphaContext, alphaMaskImageData),
              ]);
            }

            const jpegPath = path.join(output, fileName + '.jpg');
            const pngPath = path.join(output, fileName + '-alpha.png');

            return Promise.all([
              saveJPEG(jpegPath, imageCanvas, imageContext, imageData),
              savePNG(pngPath, alphaCanvas, alphaContext, alphaMaskImageData),
            ]);
          })
          .then(results => {
            this.emit('get-image.end', results);
            this.emit('write-result.start');

            const [image, alphaMask] = results;

            const svg = createSVGFromTemplate(fileName, width, height, image, alphaMask);
            const svgPath = path.join(output, fileName + '.svg');

            return writeFile(svgPath, svg, 'utf-8').then(() => svgPath);
          })
          .then(svgPath => {
            this.emit('write-result.end', svgPath);
            this.emit('create.end');
          });
      })
      .catch(err => this.emit('error', err));

    return this;
  }
}

module.exports = JPNG;

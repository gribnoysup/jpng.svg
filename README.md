# Transparent PNG with JPEG Compression

This allows to reduce image size by a lot in many cases.

More info on this method with examples, pros and cons:

- [Using SVG To Shrink Your PNGs](http://peterhrynkow.com/how-to-compress-a-png-like-a-jpeg/)
- [Transparent PNG with JPEG Compression](https://codepen.io/shshaw/full/IDbqC)
- [ZorroSVG - Put a Mask on it](http://quasimondo.com/ZorroSVG/)

I didn't found any CLI tools for this, so I thought I'd make one.

## Installation

This package requires (node-canvas)[https://github.com/Automattic/node-canvas/tree/v1.x] to be installed separately.
For installation instructions see: (Installation)[https://github.com/Automattic/node-canvas/tree/v1.x#installation]

```
npm i -g canvas jpng.svg
```

## Usage

```
jpng.svg <glob> [options]
```

## Options

```
 -o, --output <folder>  dist    Output folder
 -b, --bufsize <n>      4096    JPEG compression buffer size
 -p, --progressive      false   Progressive JPEG compression
 -q, --quality <n>      75      JPEG compression quality
 -i, --inline           false   Inline images into SVG file
 -Q, --quiet            false   Do not log the progress
```
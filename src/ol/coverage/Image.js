/**
 * @module ol/coverage/Image
 */
import ImageBase from '../ImageBase.js';
import ImageState from '../ImageState.js';
import {getHeight} from '../extent.js';
import {createCanvasContext2D} from '../dom.js';


/**
 * @typedef {function(Array.<number>, number, Array.<number>, number): HTMLCanvasElement} FunctionType
 */


/**
 * @classdesc Image class for texture-based coverages.
 */
class CoverageImage extends ImageBase {

  /**
   * @param {module:ol/extent~Extent} extent Extent.
   * @param {number} pixelRatio Pixel ratio.
   * @param {module:ol/coverage/Band} band Styled band.
   * @param {module:ol/coverage/Image~FunctionType} coverageDrawFunc Drawing function.
   */
  constructor(extent, pixelRatio, band, coverageDrawFunc) {

    super(extent, undefined, pixelRatio, ImageState.IDLE);

    /**
     * @private
     * @type {HTMLCanvasElement}
     */
    this.canvas_ = null;

    /**
     * @protected
     * @type {module:ol/ImageState}
     */
    this.state = ImageState.IDLE;

    /**
     * @private
     * @type {module:ol/coverage/Band}
     */
    this.band_ = band;

    /**
     * @private
     * @type {module:ol/coverage/Image~FunctionType}
     */
    this.coverageDrawFunction_ = coverageDrawFunc || this.getDefaultDrawFunction_();
  }

  /**
   * @inheritDoc
   */
  getImage() {
    return this.canvas_;
  }

  /**
   * @inheritDoc
   */
  load() {
    if (this.state !== ImageState.LOADED) {
      this.state = ImageState.LOADING;
      this.changed();

      try {
        const styledMatrix = /** @type {Array.<number>} */ (this.band_.getCoverageData());
        this.canvas_ = this.coverageDrawFunction_(styledMatrix, this.band_.getStride(),
          this.band_.getResolution(), this.getPixelRatio());
        this.resolution = getHeight(this.extent) / this.canvas_.height;
        this.state = ImageState.LOADED;
        this.changed();
      } catch (err) {
        this.state = ImageState.ERROR;
        this.changed();
      }

      this.band_ = undefined;
    }
  }

  /**
   * @return {module:ol/coverage/Image~FunctionType} Raster draw function.
   * @private
   */
  getDefaultDrawFunction_() {
    return function(matrix, stride, resolution, pixelRatio) {
      const mpPix = Math.ceil(pixelRatio);
      const mpY = resolution[1] / resolution[0];

      let height = matrix.length / (stride * 4);
      const rawImg = this.createContext_(stride, height);
      const imgData = rawImg.createImageData(stride, height);
      const rasterImg = new Uint8ClampedArray(matrix);
      imgData.data.set(rasterImg);
      rawImg.putImageData(imgData, 0, 0);

      height = height * mpPix * mpY;
      const width = stride * mpPix;
      const ctx = this.createContext_(width, height);
      ctx.drawImage(rawImg.canvas, 0, 0, width, height);
      return ctx.canvas;
    };
  }

  /**
   * @param {module:ol/extent~Extent} extent Extent.
   */
  updateResolution(extent) {
    if (this.state === ImageState.LOADED) {
      this.resolution = getHeight(this.extent) / this.canvas_.height;
    }
  }

  /**
   * @private
   * @param {number} width Width.
   * @param {number} height Height.
   * @return {CanvasRenderingContext2D} Context.
   */
  createContext_(width, height) {
    const ctx = createCanvasContext2D(width, height);
    ctx.mozImageSmoothingEnabled = false;
    ctx.webkitImageSmoothingEnabled = false;
    ctx.msImageSmoothingEnabled = false;
    ctx.imageSmoothingEnabled = false;

    return ctx;
  }
}

export default CoverageImage;

/**
 * @module ol/source/GeoTIFF
 */
import {assert} from '../asserts.js';
import {TYPED_ARRAY} from '../has.js';
import CoverageSource from './Coverage.js';
import State from './State.js';
import {intersects} from '../extent.js';
import {appendParams} from '../uri.js';
import {get as getGeoTIFF, set as setGeoTIFF} from '../coverage/geotiff.js';
import Band from '../coverage/Band.js';
import MatrixType from '../coverage/MatrixType.js';
import Matrix from '../coverage/Matrix.js';
import CoverageType from '../coverage/CoverageType.js';


/**
 * @typedef {Object} Options
 * @property {module:ol/source/Source~AttributionLike} [attributions] Attributions.
 * @property {module:ol/proj~ProjectionLike} [projection] Projection. It must be supplied for WCS version 1.0.0.
 * @property {boolean} [wrapX=true] Wrap the world horizontally.
 * @property {string} [url] Setting this option instructs the source to load the
 * ArcGrid file using an XHR loader with a GET request.
 * @property {module:ol/source/Coverage~WCSParams} [wcsParams] WCS request parameters.
 * If they are present, the URL is treated as a base URL for a WCS server, and
 * the supplied parameters are appended to it.
 * @property {ArrayBuffer} [data] Raw content of a GeoTIFF file. Must be an ArrayBuffer. See
 * {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/ArrayBuffer}
 * for more info.
 */


/**
* @classdesc
* Layer source for GeoTIFF rasters.
*
* @fires module:ol/source/Coverage~CoverageSourceEvent
* @api
*/
class GeoTIFF extends CoverageSource {

  /**
   * @param {module:ol/source/GeoTIFF~Options=} options Options.
   */
  constructor(options) {
    assert(options.raster || options.url, 63);
    assert(TYPED_ARRAY, 60);

    super({
      attributions: options.attributions,
      projection: options.projection,
      state: State.UNDEFINED,
      url: options.url,
      wcsParams: options.wcsParams,
      wrapX: options.wrapX
    });

    /**
     * @private
     * @type {ArrayBuffer|undefined}
     */
    this.data_ = options.data;

    /**
     * @private
     * @type {module:ol/extent~Extent|undefined}
     */
    this.extent_ = options.wcsParams ? options.wcsParams.extent : undefined;
  }

  /**
   * @inheritDoc
   */
  getCoverage(extent, index) {
    const band = this.getBands()[index];
    const rasterExtent = band.getExtent();
    if (rasterExtent && intersects(extent, rasterExtent)) {
      return band;
    }
    return null;
  }

  /**
   * @inheritDoc
   */
  loadBands() {
    if (this.getURL()) {
      this.loadCoverageXhr_();
    } else {
      this.parseCoverage_();
    }
  }

  /**
   * @inheritDoc
   */
  createWCSGetCoverageURL(url, wcsParams) {
    const getCoverageURL = CoverageSource.prototype.createWCSGetCoverageURL.call(
      this, url, wcsParams);
    const geoTiffParams = {};
    geoTiffParams['FORMAT'] = wcsParams.format ? wcsParams.format : 'image/tiff';

    return appendParams(getCoverageURL, geoTiffParams);
  }

  /**
   * @private
   */
  loadCoverageXhr_() {
    this.setState(State.LOADING);

    const xhr = new XMLHttpRequest();
    const url = /** @type {string} */ (this.getURL());
    xhr.open('GET', url, true);
    xhr.responseType = 'arraybuffer';
    /**
     * @param {Event} event Event.
     * @private
     */
    xhr.onload = function(event) {
      // status will be 0 for file:// urls
      if (!xhr.status || xhr.status >= 200 && xhr.status < 300) {
        const source = xhr.response;
        if (source) {
          this.data_ = /**  @type {ArrayBuffer} */ (source);
          this.parseCoverage_();
        } else {
          this.setState(State.ERROR);
        }
      } else {
        this.setState(State.ERROR);
      }
    }.bind(this);
    /**
     * @private
     */
    xhr.onerror = function() {
      this.setState(State.ERROR);
    }.bind(this);
    xhr.send();
  }

  /**
   * @private
   */
  parseCoverage_() {
    if (this.getState() !== State.LOADING) {
      this.setState(State.LOADING);
    }

    const GeoTIFF = getGeoTIFF();
    assert(GeoTIFF, 64);

    const tiff = GeoTIFF.parse(/** @type {ArrayBuffer} */ (this.data_));
    const numImages = tiff.getImageCount();
    let image, bands, height, width, resolution, extent, matrix, type, origin,
        nodata, i, j;

    for (i = 0; i < numImages; ++i) {
      image = tiff.getImage(i);
      height = image.getHeight();
      width = image.getWidth();
      bands = image.readRasters();
      nodata =  image.getFileDirectory() ? parseFloat(
        /** @type {string} */ (image.getFileDirectory()['GDAL_NODATA'])) : undefined;

      try {
        resolution = image.getResolution().slice(0, 2);
        origin = image.getOrigin();
        extent = [origin[0], origin[1] - resolution[1] * height,
          origin[0] + resolution[0] * width, origin[1]];

      } catch (err) {
        if (this.extent_) {
          // We calculate the resolution, if it is a WCS request, and the extent
          // is provided.
          extent = this.extent_;
          resolution = [
            (extent[2] - extent[0]) / width,
            (extent[3] - extent[1]) / height
          ];

        } else {
          this.setState(State.ERROR);
          continue;
        }
      }
      for (j = 0; j < bands.length; ++j) {
        matrix = bands[j];
        type = this.getType_(matrix);
        this.addBand(new Band({
          extent: extent,
          nodata: nodata,
          matrix: matrix.buffer,
          resolution: resolution,
          stride: width,
          type: type
        }));
      }

    }

    // Default type to rectangular.
    if (!this.getType()) {
      this.setType(CoverageType.RECTANGULAR);
    }

    this.data_ = undefined;

    if (this.getState() === State.LOADING) {
      this.setState(State.READY);
    }
  }

  /**
   * @param {module:ol/typedarray~TypedArray} typedArr Typed array.
   * @returns {module:ol/coverage/MatrixType} Raster type.
   * @private
   */
  getType_(typedArr) {
    let ctor, i;
    const types = MatrixType;
    for (i in types) {
      ctor = Matrix.getArrayConstructor(types[i]);
      if (typedArr instanceof ctor) {
        return types[i];
      }
    }
    return types.FLOAT32;
  }
}


/**
 * Register GeoTIFF. If not explicitly registered, it will be assumed that
 * GeoTIFF will be loaded in the global namespace.
 *
 * @param {?} geotiff GeoTIFF library.
 * @api
 */
GeoTIFF.setGeoTIFF = function(geotiff) {
  setGeoTIFF(geotiff);
};


export default GeoTIFF;

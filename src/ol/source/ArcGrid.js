/**
 * @module ol/source/ArcGrid
 */
import {assert} from '../asserts.js';
import CoverageSource from './Coverage.js';
import MatrixType from '../coverage/MatrixType.js';
import State from './State.js';
import {intersects} from '../extent.js';
import {appendParams} from '../uri.js';
import Band from '../coverage/Band.js';
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
 * @property {string} [data] Raw content of an ArcGrid file. Should be used with
 * preloaded data.
 * @property {module:ol/coverage/MatrixType} [dataType="32bitFloat"] Data type
 * of the layer. Default is `32bitFloat`.
 */


/**
 * @classdesc
 * Layer source for raster data in ArcInfo ASCII Grid format.
 *
 * @fires module:ol/source/Coverage~CoverageSourceEvent
 * @api
 */
class ArcGrid extends CoverageSource {

  /**
   * @param {module:ol/source/ArcGrid~Options=} options Options.
   */
  constructor(options) {

    assert(options.raster || options.url, 63);

    super({
      attributions: options.attributions,
      projection: options.projection,
      state: State.UNDEFINED,
      type: CoverageType.RECTANGULAR,
      url: options.url,
      wcsParams: options.wcsParams,
      wrapX: options.wrapX
    });

    /**
     * @private
     * @type {string|undefined}
     */
    this.data_ = options.data;


    /**
     * @private
     * @type {ol.coverage.MatrixType}
     */
    this.dataType_ = options.dataType || MatrixType.FLOAT32;
  }

  /**
   * @inheritDoc
   */
  getCoverage(extent, index) {
    const band = this.getBands()[0];
    const coverageExtent = band.getExtent();
    if (coverageExtent && intersects(extent, coverageExtent)) {
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
    const getCoverageURL = super.createWCSGetCoverageURL(url, wcsParams);
    const arcGridParams = {};
    arcGridParams['FORMAT'] = wcsParams.format ? wcsParams.format : 'ArcGrid';

    return appendParams(getCoverageURL, arcGridParams);
  }

  /**
   * @private
   */
  loadCoverageXhr_() {
    this.setState(State.LOADING);

    const xhr = new XMLHttpRequest();
    const url = /** @type {string} */ (this.getURL());
    xhr.open('GET', url, true);
    /**
     * @param {Event} event Event.
     * @private
     */
    xhr.onload = function(event) {
      // status will be 0 for file:// urls
      if (!xhr.status || xhr.status >= 200 && xhr.status < 300) {
        const source = xhr.responseText;
        if (source) {
          this.data_ = source;
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

    const source = this.data_.split('\n');
    let i, ii;

    // Parse the header and check for its validity.
    const header = {};
    for (i = 0; i < 6; ++i) {
      const headerElem = source[i].split(' ');
      const headerName = headerElem[0].toUpperCase();
      header[headerName] = parseFloat(headerElem[1]);
    }
    if (!('NCOLS' in header && 'NROWS' in header && 'XLLCORNER' in header &&
        'YLLCORNER' in header && 'CELLSIZE' in header &&
        'NODATA_VALUE' in header && Object.keys(header).length === 6)) {
      this.setState(State.ERROR);
      return;
    }

    // Parse the raster.
    let matrix = [];
    for (i = 6, ii = source.length; i < ii; ++i) {
      matrix = matrix.concat(source[i].split(' ').map(parseFloat));
    }

    // Calculate and set the layer's extent.
    const extent = [header['XLLCORNER'], header['YLLCORNER']];
    extent.push(header['XLLCORNER'] + header['CELLSIZE'] * header['NCOLS']);
    extent.push(header['YLLCORNER'] + header['CELLSIZE'] * header['NROWS']);

    // Create a band from the parsed data.
    const band = new Band({
      extent: extent,
      nodata: header['NODATA_VALUE'],
      matrix: matrix,
      resolution: [header['CELLSIZE'], header['CELLSIZE']],
      stride: /** @type {number} */ (header['NCOLS']),
      type: this.dataType_
    });
    this.addBand(band);

    this.data_ = undefined;
    this.setState(State.READY);
  }
}


export default ArcGrid;

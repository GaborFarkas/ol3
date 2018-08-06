/**
 * @module ol/source/Coverage
 */
import CoverageType from '../coverage/CoverageType.js';
import Source from './Source.js';
import {get as getProjection, equivalent} from '../proj.js';
import {unlistenByKey, listen} from '../events.js';
import EventType from '../events/EventType.js';
import CoverageEventType from './CoverageEventType.js';
import ObjectEventType from '../ObjectEventType.js';
import {ENABLE_RASTER_REPROJECTION} from '../reproj/common.js';
import State from './State.js';
import {createEmpty, extend, equals, intersects} from '../extent.js';
import ReprojImage from '../reproj/Image.js';
import CoverageImage from '../coverage/Image.js';
import {alignRasterBands} from '../coverage/util.js';
import Band from '../coverage/Band.js';
import MatrixType from '../coverage/MatrixType.js';
import {DEFAULT_WCS_VERSION} from './common.js';
import {assign} from '../obj.js';
import {appendParams} from '../uri.js';
import Event from '../events/Event.js';


/**
 * @classdesc
 * Events emitted by {@link module:ol/source/Coverage~CoverageSource} instances are instances of this
 * type.
 */
export class CoverageSourceEvent extends Event {

  /**
   * @param {string} type Type.
   * @param {module:ol/coverage/Band} band The coverage band.
   */
  constructor(type, band) {
    super(type);

    /**
     * The coverage band related to the event.
     * @type {module:ol/coverage/Band}
     * @api
     */
    this.band = band;
  }
}


/**
 * A simple object describing cell shapes along with their relationship in a coverage.
 * Every pattern starts from the centroid of the lower left cell. Column pattern
 * describes horizontal relationship, while row pattern describes vertical.
 * The shape must be in a normalized coordinate system (0,0 to 1,1) spanning
 * across the bounding box of the cell (e.g. `[[0, 0], [1, 0], [1, 1], [0, 1]]`
 * is a square).
 *
 * @typedef {Object} CoveragePattern
 * @property {Array.<module:ol/coordinate~Coordinate>} shape
 * @property {Array.<module:ol/coverage/pattern~CoverageColumnPattern>} columnPattern
 * @property {Array.<module:ol/coverage/pattern~CoverageRowPattern>} rowPattern
 */


/**
 * A pattern describing relationship between adjacent cells. The trasnlate parameter
 * applies to the centroids, while the rotation applies to the shape around its centroid.
 * Rotation is counter-clockwise, and in radians.
 *
 * @typedef {Object} CoverageColumnPattern
 * @property {Array.<number>} translate
 * @property {number} rotate
 */


/**
 * A pattern describing relationship between adjacent rows. The trasnlate parameter
 * applies to the centroids of the two rows' first cells, while the rotation applies
 * to the shape around its centroid. Rotation is counter-clockwise, and in radians.
 * The offset defines the difference between the column patters of the two rows.
 *
 * @typedef {Object} CoverageRowPattern
 * @property {Array.<number>} translate
 * @property {number} rotate
 * @property {number} offset
 */


/**
 * Parameters required for constructing WCS queries.
 *
 * @typedef {Object} WCSParams
 * @property {module:ol/extent~Extent} [extent] Coverage extent. Required for
 * version 1.0.0, but can be useful for version 2.0.1 GeoTIFFs, when the server
 * does not encode the extent in the returned file.
 * @property {string} [format] Coverage format. Default is 'ArcGrid' for
 * ArcGrid sources, and 'image/tiff' for GeoTIFF sources.
 * @property {string} layer Layer name of the requested coverage.
 * @property {Object} [params] Other parameters which will be appended to the end
 * of the WCS GetCoverage request.
 * @property {module:ol/size~Size|number} [resolution] Cell resolution. If the X
 * and Y resolutions are different, they can be specified in an array.
 * `size` and `resolution` are exclusive parameters, but one of them is mandatory
 * for WCS version 1.0.0.
 * @property {module:ol/size~Size} [size] Number of rows and number of columns.
 * `size` and `resolution` are exclusive parameters, but one of them is mandatory
 * for WCS version 1.0.0.
 * @property {string} [version=2.0.1] WCS version. Versions 1.0.0 and 2.0.1 are supported.
 */


/**
 * @typedef {Object} Options
 * @property {module:ol/source/Source~AttributionLike} [attributions]
 * @property {module:ol/proj~ProjectionLike} [projection]
 * @property {module:ol/source/State} [state]
 * @property {boolean} [wrapX=true]
 * @property {module:ol/coverage/CoverageType} [type]
 * @property {module:ol/source/Coverage~CoveragePattern} [pattern]
 * @property {string} [url]
 * @property {module:ol/source/Coverage~WCSParams} [wcsParams]
 * @property {Array.<module:ol/coverage/Band>} [bands]
 */


/**
 * @classdesc
 * Abstract base class; normally only used for creating subclasses and not
 * instantiated in apps.
 * Base class for sources providing a single coverage.
 *
 * @param {module:ol/source/Coverage~Options} options Coverage source options.
 */
class CoverageSource extends Source {

  constructor(options) {

    super({
      attributions: options.attributions,
      projection: getProjection(options.projection),
      state: options.state,
      wrapX: options.wrapX
    });

    /**
     * @private
     * @type {module:ol/coverage/CoverageType|null}
     */
    this.type_ = options.type;

    /**
     * @private
     * @type {module:ol/source/Coverage~CoveragePattern}
     */
    this.pattern_ = options.pattern;
    if (this.pattern_) {
      this.type_ = CoverageType.CUSTOM;
    }

    /**
     * @private
     * @type {module:ol/style/Style~CoverageStyle|null}
     */
    this.style_ = null;

    /**
     * @private
     * @type {?module:ol/events~EventsKey}
     */
    this.styleInitKey_ = null;

    /**
     * @private
     * @type {?module:ol/events~EventsKey}
     */
    this.styleChangeKey_ = null;

    /**
     * @private
     * @type {Array.<module:ol/coverage/Band>}
     */
    this.bands_ = [];

    /**
     * @private
     * @type {module:ol/coverage/Image}
     */
    this.image_ = null;

    /**
     * @private
     * @type {module:ol/reproj/Image}
     */
    this.reprojectedImage_ = null;

    /**
     * @private
     * @type {number}
     */
    this.reprojectedRevision_ = 0;

    /**
     * @private
     * @type {number}
     */
    this.rerenderRevision_ = 0;

    /**
     * @private
     * @type {number}
     */
    this.renderedRevision_ = 0;

    /**
     * @private
     * @type {string}
     */
    this.renderedChecksum_ = '';

    /**
     * @private
     * @type {module:ol/coverage/Image~FunctionType|null}
     */
    this.coverageDrawFunction_ = null;

    /**
     * @private
     * @type {string|undefined}
     */
    this.url_ = options.wcsParams ? this.createWCSGetCoverageURL(options.url,
      options.wcsParams) : options.url;

    if (options.bands) {
      for (let i = 0; i < options.bands.length; ++i) {
        this.addBand(options.bands[i]);
      }
    } else {
      this.loadBands();
    }
  }

  /**
   * @param {module:ol/coverage/Band} band Coverage band.
   */
  addBand(band) {
    this.bands_.push(band);
    this.setupChangeEvents_(band);
    this.changed();
  }

  /**
   * @param {module:ol/style/Style~CoverageStyle|null} style Style.
   */
  setStyle(style) {
    if (this.styleInitKey_) {
      unlistenByKey(this.styleInitKey_);
      this.styleInitKey_ = null;
    }
    this.style_ = style;
    if (style) {
      if (this.getState() === State.READY && this.getBands()) {
        this.style_.fillMissingValues(this.getBands());
      } else {
        this.styleInitKey_ = listen(this, EventType.CHANGE,
          function() {
            if (this.getState() === State.READY) {
              this.style_.fillMissingValues(this.getBands());
              unlistenByKey(this.styleInitKey_);
              this.styleInitKey_ = null;
            }
          }, this);
      }
    }
    this.changed();
    this.rerenderRevision_ = this.getRevision();
  }

  /**
   * @param {module:ol/coverage/Image~FunctionType|null} coverageDrawFunc Coverage draw function.
   */
  setCoverageDrawFunction(coverageDrawFunc) {
    this.coverageDrawFunction_ = coverageDrawFunc;
    this.changed();
    this.rerenderRevision_ = this.getRevision();
  }

  /**
   * @param {module:ol/coverage/CoverageType|null|undefined} type Coverage type.
   */
  setType(type) {
    this.type_ = type;
  }

  /**
   * @param {module:ol/coverage/Band} band Coverage band.
   * @private
   */
  setupChangeEvents_(band) {
    listen(band, EventType.CHANGE,
      this.handleCoverageChange_, this);
    listen(band, EventType.CHANGE,
      function() {
        const bandIndex = this.getBands().indexOf(band);
        const styleIndex = this.style_.getBandIndex();
        if (styleIndex.length) {
          if (styleIndex.indexOf(bandIndex) > -1) {
            this.rerenderRevision_ = this.getRevision();
          }
        } else if (styleIndex === bandIndex) {
          this.rerenderRevision_ = this.getRevision();
        }
      }, this);
    listen(band, ObjectEventType.PROPERTYCHANGE,
      this.handleCoverageChange_, this);
  }

  /**
   * Get every coverage band from this source.
   * @return {Array.<module:ol/coverage/Band>} Coverage bands.
   * @api
   */
  getBands() {
    return this.bands_.slice();
  }

  /**
   * Get the extent of the bands in this source.
   * @return {module:ol/extent~Extent} Extent.
   * @api
   */
  getExtent() {
    const bands = this.getBands();
    const extent = createEmpty();
    let i, ii;
    for (i = 0, ii = bands.length; i < ii; ++i) {
      extend(extent, bands[i].getExtent());
    }
    return extent;
  }

  /**
   * @return {module:ol/coverage/CoverageType|null|undefined} Coverage type.
   */
  getType() {
    return this.type_;
  }

  /**
   * @return {module:ol/source/Coverage~CoveragePattern} Coverage pattern.
   */
  getPattern() {
    return this.pattern_;
  }

  /**
   * Used by the coverage renderer for querying a band in an extent.
   * @abstract
   * @param {module:ol/extent~Extent} extent Extent.
   * @param {number} index Band index.
   * @return {module:ol/coverage/Band} Single band.
   * @protected
   */
  getCoverage(extent, index) {}

  /**
   * @param {module:ol/extent~Extent} extent Extent.
   * @param {number} resolution Resolution.
   * @param {number} pixelRatio Pixel ratio.
   * @param {module:ol/proj~Projection} projection Projection.
   * @return {module:ol/ImageBase} Single image.
   */
  getImage(extent, resolution, pixelRatio, projection) {
    const sourceProjection = this.getProjection();
    if (!ENABLE_RASTER_REPROJECTION ||
        !sourceProjection ||
        !projection ||
        equivalent(sourceProjection, projection)) {
      if (sourceProjection) {
        projection = sourceProjection;
      }
      return this.getImageInternal(extent, resolution, pixelRatio);
    } else {
      if (this.reprojectedImage_) {
        if (this.reprojectedRevision_ == this.getRevision() &&
            equivalent(
              this.reprojectedImage_.getProjection(), projection) &&
            this.reprojectedImage_.getResolution() == resolution &&
            this.style_.getChecksum() === this.renderedChecksum_ &&
            equals(this.reprojectedImage_.getExtent(), extent)) {
          return this.reprojectedImage_;
        }
        this.reprojectedImage_.dispose();
        this.reprojectedImage_ = null;
      }

      this.reprojectedImage_ = new ReprojImage(
        sourceProjection, projection, extent, resolution, pixelRatio,
        function(extent, resolution, pixelRatio) {
          return this.getImageInternal(extent, resolution, pixelRatio);
        }.bind(this), false);
      this.reprojectedRevision_ = this.getRevision();

      return this.reprojectedImage_;
    }
  }

  /**
   * @param {module:ol/extent~Extent} extent Extent.
   * @param {number} resolution Resolution.
   * @param {number} pixelRatio Pixel ratio.
   * @return {module:ol/coverage/Image} Single image.
   */
  getImageInternal(extent, resolution, pixelRatio) {
    if (this.getState() === State.READY &&
      intersects(extent, this.getExtent())) {
      if (this.image_ && this.renderedRevision_ >= this.rerenderRevision_ &&
          this.style_.getChecksum() === this.renderedChecksum_) {
        this.image_.updateResolution(extent);
        return this.image_;
      } else {
        const styledBand = this.getStyledBand(this.style_, 255, 0);
        if (styledBand) {
          this.image_ = new CoverageImage(styledBand.getExtent(), pixelRatio,
            styledBand, this.coverageDrawFunction_);
          this.renderedRevision_ = this.getRevision();
          this.renderedChecksum_ = this.style_.getChecksum();
          return this.image_;
        }
      }
    }
    return null;
  }

  /**
   * Returns the color values of the styled band(s) in an interleaved array.
   * @param {module:ol/style/Style~CoverageStyle} style Coverage style.
   * @param {number} minAlpha Minimum alpha value.
   * @param {number} maxAlpha Maximum alpha value.
   * @return {?module:ol/coverage/Band} A new band with styled interleaved data.
   */
  getStyledBand(style, minAlpha, maxAlpha) {
    let styledMatrix;
    const bandIndex = style.getBandIndex();
    if (Array.isArray(bandIndex)) {
      const bands = this.getBands();
      const toAlign = [];
      const nulls = [];
      let i, ii;
      for (i = 0, ii = bandIndex.length; i < ii; ++i) {
        if (bandIndex[i] !== undefined) {
          toAlign.push(bands[bandIndex[i]]);
          nulls.push(bands[bandIndex[i]].getNullValue());
        }
      }
      const aligned = alignRasterBands(toAlign, this.getType());
      styledMatrix = style.apply(aligned.matrices, nulls, minAlpha, maxAlpha);
      return new Band({
        binary: false,
        extent: aligned.properties.extent,
        matrix: styledMatrix,
        origin: aligned.properties.origin,
        stride: aligned.properties.stride,
        resolution: aligned.properties.resolution,
        type: MatrixType.UINT8
      });
    } else if (bandIndex !== undefined) {
      const band = this.getBands()[/** @type {number} */ (bandIndex)];
      styledMatrix = style.apply(band.getCoverageData(), band.getNullValue(),
        minAlpha, maxAlpha);
      return new Band({
        binary: false,
        extent: band.getExtent(),
        matrix: styledMatrix,
        origin: band.getOrigin(),
        stride: band.getStride(),
        resolution: band.getResolution(),
        type: MatrixType.UINT8
      });
    }
    return null;
  }

  /**
   * @inheritDoc
   */
  getResolutions() {
    return undefined;
  }

  /**
   * Main function of every coverage source responsible for acquiring and parsing
   * coverage data.
   * @abstract
   * @protected
   */
  loadBands() {}

  /**
   * @param {string} url Base URL.
   * @param {module:ol/source/Coverage~WCSParams} wcsParams WCS parameters.
   * @return {string} WCS GetCoverage URL.
   * @protected
   */
  createWCSGetCoverageURL(url, wcsParams) {
    const version = wcsParams.version === '1.0.0' ? '1.0.0' : DEFAULT_WCS_VERSION;

    const baseParams = {
      'SERVICE': 'WCS',
      'REQUEST': 'GetCoverage',
      'VERSION': version
    };

    switch (version) {
      case '1.0.0':
        baseParams['BBOX'] = wcsParams.extent.join(',');
        baseParams['CRS'] = this.getProjection().getCode();
        baseParams['COVERAGE'] = wcsParams.layer;
        if (wcsParams.resolution) {
          const res = wcsParams.resolution;
          baseParams['RESX'] = Array.isArray(res) ? res[0] : res;
          baseParams['RESY'] = Array.isArray(res) ? res[1] : res;
        } else if (wcsParams.size) {
          baseParams['WIDTH'] = wcsParams.size[0];
          baseParams['HEIGHT'] = wcsParams.size[1];
        }
        break;
      case '2.0.1':
        baseParams['COVERAGEID'] = wcsParams.layer;
        break;
      default:
        break;
    }

    if (wcsParams.params) {
      assign(baseParams, wcsParams.params);
    }

    return appendParams(url, baseParams);
  }

  /**
   * Returns the URL associated to this source, if any.
   * @return {string|undefined} URL.
   * @api
   */
  getURL() {
    return this.url_;
  }

  /**
   * Handle coverage change events.
   * @param {module:ol/events/Event} event Event.
   * @private
   */
  handleCoverageChange_(event) {
    const band = /** @type {module:ol/coverage/Band} */ (event.target);
    this.changed();
    this.dispatchEvent(new CoverageSourceEvent(
      CoverageEventType.CHANGEBAND, band));
  }
}


export default CoverageSource;

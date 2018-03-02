/**
 * @module ol/render/webgl/PolygonReplay
 */
import {getUid} from '../../util.js';
import {equals, extend} from '../../array.js';
import {asArray} from '../../color.js';
import {intersects} from '../../extent.js';
import {isEmpty} from '../../obj.js';
import {translate} from '../../geom/flat/transform.js';
import {fragment, vertex} from '../webgl/polygonreplay/defaultshader.js';
import Locations from '../webgl/polygonreplay/defaultshader/Locations.js';
import Tessellator from '../../webgl/Tessellator.js';
import WebGLLineStringReplay from '../webgl/LineStringReplay.js';
import WebGLReplay from '../webgl/Replay.js';
import {DEFAULT_FILLSTYLE} from '../webgl.js';
import Stroke from '../../style/Stroke.js';
import {FLOAT} from '../../webgl.js';
import WebGLBuffer from '../../webgl/Buffer.js';


class WebGLPolygonReplay extends WebGLReplay {
  /**
   * @param {number} tolerance Tolerance.
   * @param {module:ol/extent~Extent} maxExtent Max extent.
   */
  constructor(tolerance, maxExtent) {
    super(tolerance, maxExtent);

    this.lineStringReplay = new WebGLLineStringReplay(
      tolerance, maxExtent);

    /**
     * @private
     * @type {module:ol/render/webgl/polygonreplay/defaultshader/Locations}
     */
    this.defaultLocations_ = null;

    /**
     * @private
     * @type {Array<Array<number>>}
     */
    this.styles_ = [];

    /**
     * @private
     * @type {Array<number>}
     */
    this.styleIndices_ = [];

    /**
     * @private
     * @type {{fillColor: (Array<number>|null),
     *         changed: boolean}|null}
     */
    this.state_ = {
      fillColor: null,
      changed: false
    };

  }

  /**
   * Draw one polygon.
   * @param {Array<number>} flatCoordinates Flat coordinates.
   * @param {Array<Array<number>>} holeFlatCoordinates Hole flat coordinates.
   * @param {number} stride Stride.
   * @private
   */
  drawCoordinates_(flatCoordinates, holeFlatCoordinates, stride) {
    // Triangulate the polygon
    const tessellator = new Tessellator(flatCoordinates, holeFlatCoordinates, stride);

    const n = this.vertices.length / 2;
    extend(this.vertices, tessellator.vertices);
    extend(this.indices, tessellator.indices.map(function(i) {
      return i + n;
    }));
  }


  /**
   * @inheritDoc
   */
  drawMultiPolygon(multiPolygonGeometry, feature) {
    const endss = multiPolygonGeometry.getEndss();
    const stride = multiPolygonGeometry.getStride();
    const currIndex = this.indices.length;
    const currLineIndex = this.lineStringReplay.getCurrentIndex();
    const flatCoordinates = multiPolygonGeometry.getFlatCoordinates();
    let i, ii, j, jj;
    let start = 0;
    for (i = 0, ii = endss.length; i < ii; ++i) {
      const ends = endss[i];
      if (ends.length > 0) {
        const outerRing = translate(flatCoordinates, start, ends[0],
          stride, -this.origin[0], -this.origin[1]);
        if (outerRing.length) {
          const holes = [];
          let holeFlatCoords;
          for (j = 1, jj = ends.length; j < jj; ++j) {
            if (ends[j] !== ends[j - 1]) {
              holeFlatCoords = translate(flatCoordinates, ends[j - 1],
                ends[j], stride, -this.origin[0], -this.origin[1]);
              holes.push(holeFlatCoords);
            }
          }
          this.lineStringReplay.drawPolygonCoordinates(outerRing, holes, stride);
          this.drawCoordinates_(outerRing, holes, stride);
        }
      }
      start = ends[ends.length - 1];
    }
    if (this.indices.length > currIndex) {
      this.startIndices.push(currIndex);
      this.startIndicesFeature.push(feature);
      if (this.state_.changed) {
        this.styleIndices_.push(currIndex);
        this.state_.changed = false;
      }
    }
    if (this.lineStringReplay.getCurrentIndex() > currLineIndex) {
      this.lineStringReplay.setPolygonStyle(feature, currLineIndex);
    }
  }

  /**
   * @inheritDoc
   */
  drawPolygon(polygonGeometry, feature) {
    const ends = polygonGeometry.getEnds();
    const stride = polygonGeometry.getStride();
    if (ends.length > 0) {
      const flatCoordinates = polygonGeometry.getFlatCoordinates().map(Number);
      const outerRing = translate(flatCoordinates, 0, ends[0],
        stride, -this.origin[0], -this.origin[1]);
      if (outerRing.length) {
        const holes = [];
        let i, ii, holeFlatCoords;
        for (i = 1, ii = ends.length; i < ii; ++i) {
          if (ends[i] !== ends[i - 1]) {
            holeFlatCoords = translate(flatCoordinates, ends[i - 1],
              ends[i], stride, -this.origin[0], -this.origin[1]);
            holes.push(holeFlatCoords);
          }
        }

        this.startIndices.push(this.indices.length);
        this.startIndicesFeature.push(feature);
        if (this.state_.changed) {
          this.styleIndices_.push(this.indices.length);
          this.state_.changed = false;
        }
        this.lineStringReplay.setPolygonStyle(feature);

        this.lineStringReplay.drawPolygonCoordinates(outerRing, holes, stride);
        this.drawCoordinates_(outerRing, holes, stride);
      }
    }
  }

  /**
   * @inheritDoc
   **/
  finish(context) {
    // create, bind, and populate the vertices buffer
    this.verticesBuffer = new WebGLBuffer(this.vertices);

    // create, bind, and populate the indices buffer
    this.indicesBuffer = new WebGLBuffer(this.indices);

    this.startIndices.push(this.indices.length);

    this.lineStringReplay.finish(context);

    //Clean up, if there is nothing to draw
    if (this.styleIndices_.length === 0 && this.styles_.length > 0) {
      this.styles_ = [];
    }

    this.vertices = null;
    this.indices = null;
  }

  /**
   * @inheritDoc
   */
  getDeleteResourcesFunction(context) {
    const verticesBuffer = this.verticesBuffer;
    const indicesBuffer = this.indicesBuffer;
    const lineDeleter = this.lineStringReplay.getDeleteResourcesFunction(context);
    return function() {
      context.deleteBuffer(verticesBuffer);
      context.deleteBuffer(indicesBuffer);
      lineDeleter();
    };
  }

  /**
   * @inheritDoc
   */
  setUpProgram(gl, context, size, pixelRatio) {
    // get the program
    const program = context.getProgram(fragment, vertex);

    // get the locations
    let locations;
    if (!this.defaultLocations_) {
      locations = new Locations(gl, program);
      this.defaultLocations_ = locations;
    } else {
      locations = this.defaultLocations_;
    }

    context.useProgram(program);

    // enable the vertex attrib arrays
    gl.enableVertexAttribArray(locations.a_position);
    gl.vertexAttribPointer(locations.a_position, 2, FLOAT,
      false, 8, 0);

    return locations;
  }

  /**
   * @inheritDoc
   */
  shutDownProgram(gl, locations) {
    gl.disableVertexAttribArray(locations.a_position);
  }

  /**
   * @inheritDoc
   */
  drawReplay(gl, context, skippedFeaturesHash, hitDetection) {
    //Save GL parameters.
    const tmpDepthFunc = /** @type {number} */ (gl.getParameter(gl.DEPTH_FUNC));
    const tmpDepthMask = /** @type {boolean} */ (gl.getParameter(gl.DEPTH_WRITEMASK));

    if (!hitDetection) {
      gl.enable(gl.DEPTH_TEST);
      gl.depthMask(true);
      gl.depthFunc(gl.NOTEQUAL);
    }

    if (!isEmpty(skippedFeaturesHash)) {
      this.drawReplaySkipping_(gl, context, skippedFeaturesHash);
    } else {
      //Draw by style groups to minimize drawElements() calls.
      let i, start, end, nextStyle;
      end = this.startIndices[this.startIndices.length - 1];
      for (i = this.styleIndices_.length - 1; i >= 0; --i) {
        start = this.styleIndices_[i];
        nextStyle = this.styles_[i];
        this.setFillStyle_(gl, nextStyle);
        this.drawElements(gl, context, start, end);
        end = start;
      }
    }
    if (!hitDetection) {
      gl.disable(gl.DEPTH_TEST);
      gl.clear(gl.DEPTH_BUFFER_BIT);
      //Restore GL parameters.
      gl.depthMask(tmpDepthMask);
      gl.depthFunc(tmpDepthFunc);
    }
  }

  /**
   * @inheritDoc
   */
  drawHitDetectionReplayOneByOne(gl, context, skippedFeaturesHash, featureCallback, opt_hitExtent) {
    let i, start, end, nextStyle, groupStart, feature, featureUid, featureIndex;
    featureIndex = this.startIndices.length - 2;
    end = this.startIndices[featureIndex + 1];
    for (i = this.styleIndices_.length - 1; i >= 0; --i) {
      nextStyle = this.styles_[i];
      this.setFillStyle_(gl, nextStyle);
      groupStart = this.styleIndices_[i];

      while (featureIndex >= 0 &&
          this.startIndices[featureIndex] >= groupStart) {
        start = this.startIndices[featureIndex];
        feature = this.startIndicesFeature[featureIndex];
        featureUid = getUid(feature).toString();

        if (skippedFeaturesHash[featureUid] === undefined &&
            feature.getGeometry() &&
            (opt_hitExtent === undefined || intersects(
              /** @type {Array<number>} */ (opt_hitExtent),
              feature.getGeometry().getExtent()))) {
          gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
          this.drawElements(gl, context, start, end);

          const result = featureCallback(feature);

          if (result) {
            return result;
          }

        }
        featureIndex--;
        end = start;
      }
    }
    return undefined;
  }

  /**
   * @private
   * @param {WebGLRenderingContext} gl gl.
   * @param {module:ol/webgl/Context} context Context.
   * @param {Object} skippedFeaturesHash Ids of features to skip.
   */
  drawReplaySkipping_(gl, context, skippedFeaturesHash) {
    let i, start, end, nextStyle, groupStart, feature, featureUid, featureIndex, featureStart;
    featureIndex = this.startIndices.length - 2;
    end = start = this.startIndices[featureIndex + 1];
    for (i = this.styleIndices_.length - 1; i >= 0; --i) {
      nextStyle = this.styles_[i];
      this.setFillStyle_(gl, nextStyle);
      groupStart = this.styleIndices_[i];

      while (featureIndex >= 0 &&
          this.startIndices[featureIndex] >= groupStart) {
        featureStart = this.startIndices[featureIndex];
        feature = this.startIndicesFeature[featureIndex];
        featureUid = getUid(feature).toString();

        if (skippedFeaturesHash[featureUid]) {
          if (start !== end) {
            this.drawElements(gl, context, start, end);
            gl.clear(gl.DEPTH_BUFFER_BIT);
          }
          end = featureStart;
        }
        featureIndex--;
        start = featureStart;
      }
      if (start !== end) {
        this.drawElements(gl, context, start, end);
        gl.clear(gl.DEPTH_BUFFER_BIT);
      }
      start = end = groupStart;
    }
  }

  /**
   * @private
   * @param {WebGLRenderingContext} gl gl.
   * @param {Array<number>} color Color.
   */
  setFillStyle_(gl, color) {
    gl.uniform4fv(this.defaultLocations_.u_color, color);
  }

  /**
   * @inheritDoc
   */
  setFillStrokeStyle(fillStyle, strokeStyle) {
    let fillStyleColor = fillStyle ? fillStyle.getColor() : [0, 0, 0, 0];
    if (!(fillStyleColor instanceof CanvasGradient) &&
        !(fillStyleColor instanceof CanvasPattern)) {
      fillStyleColor = asArray(fillStyleColor).map(function(c, i) {
        return i != 3 ? c / 255 : c;
      }) || DEFAULT_FILLSTYLE;
    } else {
      fillStyleColor = DEFAULT_FILLSTYLE;
    }
    if (!this.state_.fillColor || !equals(fillStyleColor, this.state_.fillColor)) {
      this.state_.fillColor = fillStyleColor;
      this.state_.changed = true;
      this.styles_.push(fillStyleColor);
    }
    //Provide a null stroke style, if no strokeStyle is provided. Required for the draw interaction to work.
    if (strokeStyle) {
      this.lineStringReplay.setFillStrokeStyle(null, strokeStyle);
    } else {
      const nullStrokeStyle = new Stroke({
        color: [0, 0, 0, 0],
        lineWidth: 0
      });
      this.lineStringReplay.setFillStrokeStyle(null, nullStrokeStyle);
    }
  }
}


export default WebGLPolygonReplay;

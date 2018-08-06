/**
 * @module ol/coverage/geotiff
 */


/**
 * @private
 * @type {?}
 */
let cache = null;


/**
 * Store the GeoTIFF function.
 * @param {?} geotiff The GeoTIFF library namespace.
 */
export function set(geotiff) {
  cache = geotiff;
}


/**
 * Get the GeoTIFF lib.
 * @return {?} The GeoTIFF function set above or available globally.
 */
export function get() {
  return cache || window['GeoTIFF'];
}

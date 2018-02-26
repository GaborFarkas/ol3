/**
 * @module ol/render/webgl/coveragereplay/defaultshader/Locations
 */
// This file is automatically generated, do not edit
import {DEBUG_WEBGL} from '../../../../index.js';

/**
 * @constructor
 * @param {WebGLRenderingContext} gl GL.
 * @param {WebGLProgram} program Program.
 * @struct
 */
const _ol_render_webgl_coveragereplay_defaultshader_Locations_ = function(gl, program) {

  /**
   * @type {WebGLUniformLocation}
   */
  this.u_projectionMatrix = gl.getUniformLocation(
    program, DEBUG_WEBGL ? 'u_projectionMatrix' : 'd');

  /**
   * @type {WebGLUniformLocation}
   */
  this.u_offsetScaleMatrix = gl.getUniformLocation(
    program, DEBUG_WEBGL ? 'u_offsetScaleMatrix' : 'e');

  /**
   * @type {WebGLUniformLocation}
   */
  this.u_offsetRotateMatrix = gl.getUniformLocation(
    program, DEBUG_WEBGL ? 'u_offsetRotateMatrix' : 'f');

  /**
   * @type {WebGLUniformLocation}
   */
  this.u_opacity = gl.getUniformLocation(
    program, DEBUG_WEBGL ? 'u_opacity' : 'g');

  /**
   * @type {number}
   */
  this.a_position = gl.getAttribLocation(
    program, DEBUG_WEBGL ? 'a_position' : 'b');

  /**
   * @type {number}
   */
  this.a_color = gl.getAttribLocation(
    program, DEBUG_WEBGL ? 'a_color' : 'c');
};

export default _ol_render_webgl_coveragereplay_defaultshader_Locations_;

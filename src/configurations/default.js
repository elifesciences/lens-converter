"use strict";

var DefaultConfiguration = function() {};

DefaultConfiguration.Prototype = function() {

  // As this is a base class we tolerate unused variables to preserve the signatures
  /* jshint unused: false */

  // Get baseURL either from XML or from the converter options
  // --------
  //

  this.getBaseURL = function(state) {
    // Use xml:base attribute if present
    var baseURL = state.xmlDoc.querySelector("article").getAttribute("xml:base");
    return baseURL || state.options.baseURL;
  };

  this.enhanceArticle = function(converter, state, article) {
    // Noop - override in your configuration
  };

  this.enhanceCover = function(state, node, element) {
    // Noop - override in your configuration
  };

  // Implements resolving of relative urls
  this.enhanceFigure = function(state, node, element) {
    var graphic = element.querySelector("graphic");
    var url = graphic.getAttribute("xlink:href");
    node.url = this.resolveURL(state, url);
  };

  this.enhancePublicationInfo = function(converter, state, article) {
    // Noop - override in your configuration
  };

  this.enhanceSupplement = function(state, node, element) {
    // Noop - override in your configuration
  };

  this.enhanceTable = function(state, node, element) {
    // Noop - override in your configuration
  };

  // Default video resolver
  // --------
  //

  this.enhanceVideo = function(state, node, element) {
    var el = element.querySelector("media") || element;
    // xlink:href example: elife00778v001.mov

    var url = element.getAttribute("xlink:href");
    var name;
    // Just return absolute urls
    if (url.match(/http:/)) {
      var lastdotIdx = url.lastIndexOf(".");
      name = url.substring(0, lastdotIdx);
      node.url = name+".mp4";
      node.url_ogv = name+".ogv";
      node.url_webm = name+".webm";
      node.poster = name+".png";
      return;
    } else {
      var baseURL = this.getBaseURL(state);
      name = url.split(".")[0];
      node.url = baseURL+name+".mp4";
      node.url_ogv = baseURL+name+".ogv";
      node.url_webm = baseURL+name+".webm";
      node.poster = baseURL+name+".png";
    }
  };

  this.extractDate = function(dateEl) {
    if (!dateEl) return null;
    var day = dateEl.querySelector("day").textContent;
    var month = dateEl.querySelector("month").textContent;
    var year = dateEl.querySelector("year").textContent;
    return [year, month, day].join("-");
  };

  // Default figure url resolver
  // --------
  //
  // For relative urls it uses the same basebath as the source XML

  this.resolveURL = function(state, url) {
    // Just return absolute urls
    if (url.match(/http:/)) return url;
    return [
      state.options.baseURL,
      url
    ].join('');
  };

  this.viewMapping = {
    // "image": "figures",
    "box": "content",
    "supplement": "figures",
    "figure": "figures",
    "table": "figures",
    "video": "figures"
  };

  this.enhanceAnnotationData = function(state, anno, element, type) {
  };

  this.showNode = function(state, node) {
    var view = this.viewMapping[node.type] || "content";
    state.doc.show(view, node.id);
  };

};

DefaultConfiguration.prototype = new DefaultConfiguration.Prototype();
module.exports = DefaultConfiguration;

var _ = require('underscore');


var DefaultConfiguration = function() {

};

DefaultConfiguration.Prototype = function() {

  this.enhanceSupplement = function(state, node, element) {
    // Noop - override in your configuration
  };

  this.enhanceTable = function(state, node, element) {
    // Noop - override in your configuration
  };

  this.enhanceCover = function(state, node, element) {
    // Noop - override in your configuration
  };

  // Default video resolver
  // --------
  // 

  this.enhanceVideo = function(state, node, element) {
    var el = element.querySelector("media") || element;

    // xlink:href example: elife00778v001.mov
    var url = element.getAttribute("xlink:href");
    // Just return absolute urls
    if (url.match(/http:/)) {
      var lastdotIdx = url.lastIndexOf(".");
      var name = url.substring(0, lastdotIdx);
      node.url = name+".mp4";
      node.url_ogv = name+".ogv";
      node.url_webm = name+".webm";
      node.poster = name+".png";
      return;
    } else {
      var name = url.split(".")[0];
      node.url = state.options.baseURL+name+".mp4";
      node.url_ogv = state.options.baseURL+name+".ogv";
      node.url_webm = state.options.baseURL+name+".webm";
      node.poster = state.options.baseURL+name+".png";
    }
  };

  // Implements resloving of relative urls
  this.enhanceFigure = function(state, node, element) {
    var graphic = element.querySelector("graphic");
    var url = graphic.getAttribute("xlink:href");
    node.url = this.resolveURL(state, url);
  };

  this.enhanceArticle = function(converter, state, article) {
    // Noop - override in your configuration
  };

  this.extractPublicationInfo = function() {
    // Noop - override in your configuration
  };

  this.resolveURL = function(url) {
    return url;
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
};

DefaultConfiguration.prototype = new DefaultConfiguration.Prototype();
module.exports = DefaultConfiguration;

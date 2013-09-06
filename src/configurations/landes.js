var DefaultConfiguration = require('./default');

var LandesConfiguration = function() {

};

LandesConfiguration.Prototype = function() {

  var mappings = {
    "CC": "cc",
    "INTV": "intravital",
    "CIB": "cib"
  };        

  var __super__ = DefaultConfiguration.prototype;

  // Provide proper url for supplement
  // --------
  // 

  this.enhanceSupplement = function(state, node, element) {
    var el = element.querySelector("graphic, media") || element;
    var url = el.getAttribute("xlink:href");

    var publisherId = state.xmlDoc.querySelector('journal-id').textContent;

    var url = [
      "https://www.landesbioscience.com/journals/",
      mappings[publisherId],
      "/",
      url,
    ].join('');

    node.url = url;
  };

  // Yield proper video urls
  // --------
  // 

  this.enhanceVideo = function(state, node, element) {
    node.url = "provide_url_here";
  };

  // Customized labels
  // -------

  this.enhanceFigure = function(state, node, element) {
    var graphic = element.querySelector("graphic");
    var url = graphic.getAttribute("xlink:href");
    var publisherId = state.xmlDoc.querySelector('journal-id').textContent;

    var url = [
      "https://www.landesbioscience.com/article_figure/journals/",
      mappings[publisherId],
      "/",
      url,
    ].join('');

    node.url = url;

    if(!node.label) {
      var type = node.type;
      node.label = type.charAt(0).toUpperCase() + type.slice(1);
    }
  };
};


LandesConfiguration.Prototype.prototype = DefaultConfiguration.prototype;
LandesConfiguration.prototype = new LandesConfiguration.Prototype();
LandesConfiguration.prototype.constructor = LandesConfiguration;

module.exports = LandesConfiguration;

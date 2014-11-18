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

  this.getPublisherId = function(state) {
    var xmlAdapter = state.xmlAdapter;
    var journalIdEl = xmlAdapter.find(state.xmlDoc, "//journal-id");
    var publisherId = journalIdEl ? xmlAdapter.getText(journalIdEl) : "";
    return publisherId;
  };

  // Provide proper url for supplement
  // --------
  //

  this.enhanceSupplement = function(state, node, element) {
    var xmlAdapter = state.xmlAdapter;
    var el = xmlAdapter.find("graphic|media") || element;
    var url = xmlAdapter.getAttribute(el, "xlink:href");
    var publisherId = this.getPublisherId(state);
    url = [
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
    var xmlAdapter = state.xmlAdapter;
    var graphic = xmlAdapter.find(element, "graphic");
    var url = xmlAdapter.getAttribute(graphic, "xlink:href");
    var publisherId = this.getPublisherId(state);
    url = [
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

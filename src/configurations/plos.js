var DefaultConfiguration = require('./default');

var PLOSConfiguration = function() {

};

PLOSConfiguration.Prototype = function() {

  // Resolve figure urls
  // --------
  // 

  this.enhanceFigure = function(state, node, element) {
    var graphic = element.querySelector("graphic");
    var url = graphic.getAttribute("xlink:href");

    url = [
      "http://www.plosone.org/article/fetchObject.action?uri=",
      url,
      "&representation=PNG_M"
    ].join('');

    node.url = url;
  };

  // Assign video url
  // --------
  // 

  this.enhanceVideo = function(state, node, element) {
    node.url = "http://mickey.com/mouse.mp4";
  };
};


PLOSConfiguration.Prototype.prototype = DefaultConfiguration.prototype;
PLOSConfiguration.prototype = new PLOSConfiguration.Prototype();
PLOSConfiguration.prototype.constructor = PLOSConfiguration;

module.exports = PLOSConfiguration;

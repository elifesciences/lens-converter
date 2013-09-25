var DefaultConfiguration = require('./default');

var PeerJConfiguration = function() {

};

PeerJConfiguration.Prototype = function() {

  // Resolve figure urls
  // --------
  // 

  this.enhanceFigure = function(state, node, element) {
    var graphic = element.querySelector("graphic");
    var url = graphic.getAttribute("xlink:href");

    node.url = url;
  };

  // Assign video url
  // --------
  // 

  this.enhanceVideo = function(state, node, element) {
    node.url = "http://mickey.com/mouse.mp4";
  };
};


PeerJConfiguration.Prototype.prototype = DefaultConfiguration.prototype;
PeerJConfiguration.prototype = new PeerJConfiguration.Prototype();
PeerJConfiguration.prototype.constructor = PeerJConfiguration;

module.exports = PeerJConfiguration;

var DefaultConfiguration = require('./default');

var PeerJConfiguration = function() {

};

PeerJConfiguration.Prototype = function() {

  this.resolveFigureURL = function(state, url) {
    return url;
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

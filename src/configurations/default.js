
var DefaultConfiguration = function() {

};

DefaultConfiguration.Prototype = function() {

  this.enhanceSupplement = function(state, node, element) {
    // Noop - override in your configuration
  };

  this.enhanceTable = function(state, node, element) {
    // Noop - override in your configuration
  };

  this.enhanceVideo = function(state, node, element) {
    // Noop - override in your configuration
  };

  this.enhanceFigure = function(state, node, element) {
    // Noop - override in your configuration
  };

  this.enhanceArticle = function(converter, state, article) {
    // Noop - override in your configuration
  };

  this.extractPublicationInfo = function() {
    // Noop - override in your configuration
  };
};

DefaultConfiguration.prototype = new DefaultConfiguration.Prototype();

module.exports = DefaultConfiguration;

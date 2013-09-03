
var DefaultConfiguration = function() {

};

DefaultConfiguration.Prototype = function() {

  // Resolve figure urls.
  // --------
  // 
  // By default, figures are expected at the baseURL of the source XML
  // This can be overriden by a configuration

  this.resolveFigureURL = function(state, figure) {

    var graphic = figure.querySelector("graphic");
    var url = graphic.getAttribute("xlink:href");

    return url;
  };

  this.resolveFileURL = function(state, supplement) {
    return "http://mickey.com/mouse.pdf"
  };
};

DefaultConfiguration.prototype = new DefaultConfiguration.Prototype();

module.exports = DefaultConfiguration;
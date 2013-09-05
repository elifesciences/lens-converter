
var DefaultConfiguration = function() {

};

DefaultConfiguration.Prototype = function() {

  // Resolve figure urls.
  // --------
  // 
  // By default, figures are expected at the baseURL of the source XML
  // This can be overriden by a configuration

  this.resolveFigureURLs = function(state, figure) {

    var graphic = figure.querySelector("graphic");
    var url = graphic.getAttribute("xlink:href");
    // return url;

    return {
      url: url,
      large_url: url,
    };
  };

  this.resolveVideoURLs = function(state, supplement) {
    return {
      url: "http://mickey.com/mouse.pdf"
    };
  };

  this.resolveFileURL = function(state, supplement) {
    return "http://mickey.com/mouse.pdf"
  };

  // Default behavior for figure title, label and caption
  // --------
  // 
  // Can be overriden by specific configurations

  // this.addFigureThingies = function(converter, state, figure, element) {

  //   // Caption: is a paragraph
  //   var caption = element.querySelector("caption");
  //   if (caption) {
  //     var captionNode = converter.caption(state, caption);
  //     if (captionNode) figure.caption = captionNode.id;
  //   }

  //   var label = element.querySelector("label");
  //   if (label) {
  //     figure.label = label.textContent;
  //   }

  //   var title = element.querySelector("title");
  //   if (title) {
  //     figure.title = title.textContent;
  //   }
  // };

};

DefaultConfiguration.prototype = new DefaultConfiguration.Prototype();

module.exports = DefaultConfiguration;

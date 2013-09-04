var DefaultConfiguration = require('./default');


var ElifeConfiguration = function() {

};


ElifeConfiguration.Prototype = function() {

  // Resolve figure url
  // --------
  // 
  // By default, figures are expected at the baseURL of the source XML
  // This can be overriden by a configuration

  this.resolveFigureURLs = function(state, figure) {
    var graphic = figure.querySelector("graphic");
    var url = graphic.getAttribute("xlink:href");

    // Example url to SVG: http://cdn.elifesciences.org/elife-articles/00768/svg/elife00768f001.svg
    // Where are the images with that layout?
    
    url = [
      "http://cdn.elifesciences.org/elife-articles/",
      state.doc.id,
      "/svg/",
      url,
      ".svg"
    ].join('');

    return {
      url: url,
      large_url: url
    };
  };

 this.resolveVideoURLs = function(state, video) {
   var node = video.querySelector("media") || video;
   var name = (node.getAttribute("xlink:href")).replace(/\.[^\.]+$/g, '');
   var result = [];
   result.url = "http://static.movie-usa.glencoesoftware.com/mp4/10.7554/"+name+".mp4";
   result.url_ogv = "http://static.movie-usa.glencoesoftware.com/ogv/10.7554/"+name+".ogv";
   //result.url_webm = "http://static.movie-usa.glencoesoftware.com/webm/10.7554/"+name+".webm";
   result.poster = "http://static.movie-usa.glencoesoftware.com/jpg/10.7554/"+name+".jpg";
   return result;
  };      

  this.resolveFileURL = function(state, supplement) {
    return "http://mickey.com/mouse.pdf"
  };
};

ElifeConfiguration.Prototype.prototype = DefaultConfiguration.prototype;
ElifeConfiguration.prototype = new ElifeConfiguration.Prototype();
ElifeConfiguration.prototype.constructor = ElifeConfiguration;

module.exports = ElifeConfiguration;

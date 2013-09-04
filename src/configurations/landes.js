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

  // Resolve figure url
  // --------
  // 
  // Add description here

  this.resolveFigureURLs = function(state, figure) {
    var graphic = figure.querySelector("graphic");
    var url = graphic.getAttribute("xlink:href");

    // TODO: use journalId directly encoded in the xml doc.
    // var journalId = document.querySelector('journal-id').getAttribute('journal-id-type');
    var publisherId = state.xmlDoc.querySelector('journal-id').textContent;
    //var journalTitle = state.xmlDoc.querySelector('journal-title').textContent;

    var url = [
      "https://www.landesbioscience.com/article_figure/journals/",
      mappings[publisherId],
      "/",
      url,
    ].join('');

    return {
      url: url,
      large_url: url
    };
  };

  // Called when files (supplements) are constructed
  // -------

  this.resolveFileURL = function(state, supplement) {
    var node = supplement.querySelector("graphic, media") || supplement;
    var url = node.getAttribute("xlink:href");
    // TODO: use journalId directly encoded in the xml doc.
    var publisherId = state.xmlDoc.querySelector('journal-id').textContent;

    var url = [
      "https://www.landesbioscience.com/journals/",
      mappings[publisherId],
      "/",
      url,
    ].join('');  

    return url;
  };      
  
  this.resolveVideoURLs = function(state, video) {
    return {url:"http://mickey.com/mouse.pdf"};
  };   

  // Use custom magic for figure labels.
  // -------

  this.addFigureThingies = function(converter, state, figure, element) {
    __super__.addFigureThingies.call(this, converter, state, figure, element);

    if(!figure.label) {
      var type = figure.type;
      figure.label = type.charAt(0).toUpperCase() + type.slice(1);
    }
    
    /*if(figure.type == 'supplement') {
      _.each(figure.files, function(f) {
          var file = ''; //get file by id, then edit description
          file.description = "("+(file.url).match(/\.[^\.]+$/g)[0]+")";
        });      
    }*/
  };
};


LandesConfiguration.Prototype.prototype = DefaultConfiguration.prototype;
LandesConfiguration.prototype = new LandesConfiguration.Prototype();
LandesConfiguration.prototype.constructor = LandesConfiguration;

module.exports = LandesConfiguration;

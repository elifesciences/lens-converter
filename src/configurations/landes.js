var LandesConfiguration = function() {

};

LandesConfiguration.Prototype = function() {

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
    var journalTitle = state.xmlDoc.querySelector('journal-title').textContent;

    var mappings = {
      "CC": "cc",
      "INTV": "intravital",
      "CIB": "cib"
    };

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
  

  this.resolveFileURL = function(state, supplement) {
    return "http://mickey.com/mouse.pdf"
  };
};

LandesConfiguration.prototype = new LandesConfiguration.Prototype();

module.exports = LandesConfiguration;
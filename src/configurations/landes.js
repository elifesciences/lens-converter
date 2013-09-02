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

    var journalTitle = state.xmlDoc.querySelector('journal-title').textContent;

    var mappings = {
      "Cell Cycle": "cc"
    };

    var url = [
      "https://www.landesbioscience.com/article_figure/journals/",
      "cc", // mappings[journalTitle]
      "/",
      url,
    ].join('');

    return {
      url: url,
      large_url: url
    };
  };
};

LandesConfiguration.prototype = new LandesConfiguration.Prototype();

module.exports = LandesConfiguration;
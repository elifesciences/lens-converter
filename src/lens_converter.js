"use strict";

var Converter = null;
var Converter = require("substance-converter");
var NLMImporter = Converter.NLMImporter;

var LensImporter = function() {

  this.viewMappings = {
    "table": "figures",
    "image": "figures",
    "figure": "figures",
    "video": "figures",
    "mixed_citation": "citations",
    "article_citation": "citations",
  };
};

LensImporter.Prototype = function() {

  // Overridden to create a Lens Article instance
  this.createDocument = function() {
    var Article = require("lens-article");
    var doc = new Article();
    return doc;
  };

  // This is called for top-level nodes which should be added to a view
  // TODO: this is experimental, and needs some experience from developing a more complex converter (e.g., for lens)
  this.show = function(state, nodes) {
    var doc = state.doc;
    
    // Defaults to content
    function getView(viewName) {
      return doc.get(viewName || "content").nodes;
    }

    // show the created nodes in the content view
    for (var j = 0; j < nodes.length; j++) {
      var node = nodes[j];
      var view = getView(this.viewMappings[node.type]);

      view.push(node.id);
    }
  };
};

LensImporter.Prototype.prototype = NLMImporter.prototype;
LensImporter.prototype = new LensImporter.Prototype();

module.exports = {
  Importer: LensImporter
};

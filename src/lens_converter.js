"use strict";

var _ = require("underscore");
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

  var _annotationTypes = {
    "bold": "strong",
    "italic": "emphasis",
    "monospace": "code",
    "sub": "subscript",
    "sup": "superscript",
    "underline": "underline",
    "xref": ""
  };

  this.isAnnotation = function(type) {
    return _annotationTypes[type] !== undefined;
  };

  this.createAnnotation = function(state, el, start, end) {
    var type = el.tagName.toLowerCase();
    var anno = {
      path: _.last(state.stack).path,
      range: [start, end],
    };
    if (type === "xref") {
      var refType = el.getAttribute("ref-type");
      var targetId = el.getAttribute("rid");
      if (refType === "bibr") {
        anno.type = "citation_reference";
      } else if (refType === "fig" || refType === "table") {
        anno.type = "figure_reference";
      }
      // 'supplementary-material', disp-formula
      else {
        console.log("Ignoring xref: ", refType, el);
        return;
      }
      anno.target = targetId;
    }
    // Common annotations (e.g., emphasis)
    else if (_annotationTypes[type] !== undefined) {
      anno.type = _annotationTypes[type];
    }
    else {
      console.log("Ignoring annotation: ", type, el);
      return;
    }
    anno.id = state.nextId(anno.type);

    state.annotations.push(anno);
  };
};

LensImporter.Prototype.prototype = NLMImporter.prototype;
LensImporter.prototype = new LensImporter.Prototype();

module.exports = {
  Importer: LensImporter
};

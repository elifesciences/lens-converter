"use strict";

var _ = require("underscore");
var Converter = require("substance-converter");
var ImporterError = Converter.ImporterError;
var NLMImporter = Converter.NLMImporter;

var LensImporter = function() {
};

LensImporter.Prototype = function() {

  // Overridden to create a Lens Article instance
  this.createDocument = function() {
    var Article = require("lens-article");
    var doc = new Article();
    return doc;
  };

  var _viewMapping = {
    "image": "figures",
    "table": "figures",
    "video": "figures"
  };

  this.show = function(state, nodes) {
    var doc = state.doc;

    _.each(nodes, function(n) {
      var view = _viewMapping[n.type] || "content";
      doc.show(view, n.id);
    });
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

  this.figure = function(state, figure) {
    var doc = state.doc;

    var imageNode = {
      type: "image",
      "label": "",
      "title": "",
      "url": "",
      "large_url": "",
      "caption": null
    };
    var id = figure.getAttribute("id") || state.nextId(imageNode.type);
    imageNode.id = id;

    // Caption: is a paragraph
    var caption = figure.querySelector("caption");
    if (caption) {
      var p = caption.querySelector("p");
      var nodes = this.paragraph(state, p);
      if (nodes.length > 1) {
        throw new ImporterError("Ooops. Not ready for that...");
      }
      imageNode.caption = nodes[0].id;
    }

    var graphic = figure.querySelector("graphic");
    var url = graphic.getAttribute("xlink:href");
    imageNode.url = url;
    imageNode.large_url = url;

    var label = figure.querySelector("label");
    if (label) {
      imageNode.label = label.textContent;
    }

    var title = figure.querySelector("title");
    if (title) {
      imageNode.title = title.textContent;
    }

    doc.create(imageNode);
    return imageNode;
  };

};

LensImporter.Prototype.prototype = NLMImporter.prototype;
LensImporter.prototype = new LensImporter.Prototype();

module.exports = {
  Importer: LensImporter
};

"use strict";

var _ = require("underscore");
var Converter = require("substance-converter");
var ImporterError = Converter.ImporterError;
var NLMImporter = Converter.NLMImporter;

var LensImporter = function() {
};

LensImporter.Prototype = function() {

  var __super__ = NLMImporter.prototype;

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

  this.front = function(state, front) {
    __super__.front.call(this, state, front);

    var doc = state.doc;
    var docNode = doc.get("document");
    var cover = {
      id: "cover",
      type: "cover",
      title: docNode.title,
      authors: docNode.authors,
      abstract: docNode.abstract
    };
    doc.create(cover);
    doc.show("content", cover.id);
  };

  // Annotations
  // --------

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

  this.refList = function(state, refList) {
    var refs = refList.querySelectorAll("ref");
    for (var i = 0; i < refs.length; i++) {
      this.ref(state, refs[i]);
    }
  };

  this.ref = function(state, ref) {

    var children = ref.children;
    for (var i = 0; i < children.length; i++) {
      var child = children[i];
      var type = this.getNodeType(child);

      if (type === "mixed-citation" || type === "element-citation") {
        this.citation(state, ref, child);
      } else {
        console.log("Not supported in 'ref': ", type);
      }
    }
  };

  var _getName = function(nameEl) {
    var names = [];

    var surnameEl = nameEl.querySelector("surname");
    var givenNamesEl = nameEl.querySelector("given-names");

    if (givenNamesEl) names.push(givenNamesEl.textContent);
    if (surnameEl) names.push(surnameEl.textContent);

    return names.join(" ");
  };

  // TODO: is implemented naively, should be implemented considering the NLM spec
  this.citation = function(state, ref, citation) {
    var doc = state.doc;
    var i;

    var id = ref.getAttribute("id");
    if (!id) {
      throw new ImporterError("Expected 'id' in ref.");
    }

    var articleCitation = {
      id: id,
      type: "article_citation",
      title: "N/A",
      label: "",
      authors: [],
      doi: "",
      source: "",
      volume: "",
      fpage: "",
      lpage: "",
      citation_urls: []
    };

    // TODO: we should consider to have a more structured citation type
    // and let the view decide how to render it instead of blobbing everything here.
    var personGroup = citation.querySelector("person-group");
    var nameElements = personGroup.querySelectorAll("name");
    for (i = 0; i < nameElements.length; i++) {
      articleCitation.authors.push(_getName(nameElements[i]));
    }

    var articleTitle = citation.querySelector("article-title");
    if (articleTitle) {
      articleCitation.title = articleTitle.textContent;
    } else {
      console.error("FIXME: this citation has no title", citation);
    }

    var source = citation.querySelector("source");
    if (source) articleCitation.source = source.textContent;

    var volume = citation.querySelector("volume");
    if (volume) articleCitation.volume = volume.textContent;

    var fpage = citation.querySelector("fpage");
    if (fpage) articleCitation.fpage = fpage.textContent;

    var lpage = citation.querySelector("lpage");
    if (lpage) articleCitation.lpage = lpage.textContent;

    var year = citation.querySelector("year");
    if (year) articleCitation.year = year.textContent;

    // Note: the label is child of 'ref'
    var label = ref.querySelector("label");
    if(label) articleCitation.label = label.textContent;

    var pubIds = citation.querySelectorAll("pub-id");
    for (i = 0; i < pubIds.length; i++) {
      if(pubIds[i].getAttribute("pub-id-type") === "doi") {
        articleCitation.doi = pubIds[i].textContent;
        break;
      }
    }

    doc.create(articleCitation);
    doc.show("citations", id);
  };

};

LensImporter.Prototype.prototype = NLMImporter.prototype;
LensImporter.prototype = new LensImporter.Prototype();

module.exports = {
  Importer: LensImporter
};

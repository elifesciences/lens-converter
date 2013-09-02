"use strict";

var _ = require("underscore");
var Converter = require("substance-converter");
var ImporterError = Converter.ImporterError;
var NLMImporter = Converter.NLMImporter;

var ElifeConfiguration = require("./configurations/elife");



// Create config object
// --------
// 
// TODO: Config object should be dynamically created based on
// what config should be used for a particular file

var config = new ElifeConfiguration();

var LensImporter = function(options) {
  this.options;
};

LensImporter.Prototype = function() {

  var __super__ = NLMImporter.prototype;

  // Helpers
  // --------

  var _getName = function(nameEl) {
    var names = [];

    var surnameEl = nameEl.querySelector("surname");
    var givenNamesEl = nameEl.querySelector("given-names");

    if (givenNamesEl) names.push(givenNamesEl.textContent);
    if (surnameEl) names.push(surnameEl.textContent);

    return names.join(" ");
  };

  var _toHtml = function(el) {
    var tmp = document.createElement("DIV");
    tmp.appendChild(el.cloneNode(true));
    return tmp.innerHTML;
  };

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

  // Note: Substance.Article supports only one author.
  // We use the first author found in the contribGroup for the 'creator' property.
  this.contribGroup = function(state, contribGroup) {
    var i;
    var affiliations = contribGroup.querySelectorAll("aff");
    for (i = 0; i < affiliations.length; i++) {
      this.affiliation(state, affiliations[i]);
    }

    var contribs = contribGroup.querySelectorAll("contrib");
    for (i = 0; i < contribs.length; i++) {
      this.contributor(state, contribs[i]);
    }
  };

  this.affiliation = function(state, aff) {
    var doc = state.doc;

    //TODO: this needs a proper specification in Lens.Article
    var id = aff.getAttribute("id") || state.nextId("institution");
    var institutionNode = {
      id: id,
      type: "institution",
    };

    // TODO: fill the node
    // var label = aff.querySelector("label");
    // if (label) institutionNode.label = label.textContent;

    // var name = aff.querySelector("institution");
    // if (name) institutionNode.name = name.textContent;

    doc.create(institutionNode);
  };

  this.contributor = function(state, contrib) {
    var doc = state.doc;

    var id = contrib.getAttribute("id") || state.nextId("person");
    var personNode = {
      id: id,
      type: "person",
      name: "",
      affiliations: [],
      // Not yet supported... need examples
      image: "",
      emails: [],
      contribution: ""
    };

    var nameEl = contrib.querySelector("name");
    personNode.name = _getName(nameEl);

    // extract affiliations stored as xrefs
    var xrefs = contrib.querySelectorAll("xref");
    for (var i = 0; i < xrefs.length; i++) {
      var xref = xrefs[i];
      if (xref.getAttribute("ref-type") === "aff") {
        personNode.affiliations.push(xref.getAttribute("rid"));
      }
    }

    if (contrib.getAttribute("contrib-type") === "author") {
      doc.nodes.document.authors.push(id);
    }

    doc.create(personNode);
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
    "ext-link": "link",
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

      if (type === "ext-link") {
        anno.url = el.getAttribute("xlink:href");
      }

    }
    else {
      console.log("Ignoring annotation: ", type, el);
      return;
    }
    anno.id = state.nextId(anno.type);

    state.annotations.push(anno);
  };

  // Figures
  // --------

  this.caption = function(state, caption) {
    var p = caption.querySelector("p");
    if (!p) return null;

    var nodes = this.paragraph(state, p);
    if (nodes.length > 1) {
      throw new ImporterError("Ooops. Not ready for that...");
    }
    return nodes[0];
  };

  // Adds label, title and caption.
  // This method is reused among the figure like elements such as
  // 'image', 'table', and 'video'
  this.addFigureThingies = function(state, node, element) {
    // Caption: is a paragraph
    var caption = element.querySelector("caption");
    if (caption) {
      var captionNode = this.caption(state, caption);
      if (captionNode) node.caption = captionNode.id;
    }

    var label = element.querySelector("label");
    if (label) {
      node.label = label.textContent;
    }

    var title = element.querySelector("title");
    if (title) {
      node.title = title.textContent;
    }
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
    
    imageNode.url = config.resolveFigureURL(state, figure);
    imageNode.large_url = config.resolveFigureURL(state, figure);

    this.addFigureThingies(state, imageNode, figure);

    doc.create(imageNode);
    return imageNode;
  };


  this.media = function(state, media) {
    var mimetype = media.getAttribute("mimetype");
    if (mimetype === "video") {
      return this.video(state, media);
    } else {
      throw new ImporterError("Media type not supported yet: " + mimetype);
    }
  };

  this.video = function(state, video) {
    var doc = state.doc;

    var id = video.getAttribute("id") || state.nextId("video");
    var videoNode = {
      id: id,
      type: "video",
      label: "",
      title: "",
      url: "",
      caption: null,
      // TODO: these are not used yet... need examples
      doi: "",
      url_web: "",
      url_ogv: "",
      poster: ""
    };

    var url = video.getAttribute("xlink:href");
    if (url) {
      videoNode.url = url;
    }

    this.addFigureThingies(state, videoNode, video);

    doc.create(videoNode);

    return videoNode;
  };

  this.tableWrap = function(state, tableWrap) {
    var doc = state.doc;

    var id = tableWrap.getAttribute("id") || state.nextId("table");
    var tableNode = {
      id: id,
      type: "table",
      title: "",
      label: "",
      content: "",
      caption: null,
      // Not supported yet ... need examples
      footers: [],
      doi: ""
    };

    // Note: using a DOM div element to create HTML
    var table = tableWrap.querySelector("table");
    tableNode.content = _toHtml(table);

    this.addFigureThingies(state, tableNode, tableWrap);

    doc.create(tableNode);
    return tableNode;
  };

  this.formula = function(state, dispFormula) {
    var doc = state.doc;

    var id = dispFormula.getAttribute("id") || state.nextId("formula");
    var formulaNode = {
      id: id,
      type: "formula",
      label: "",
      data: "",
      format: ""
    };

    var label = dispFormula.querySelector("label");
    if (label) formulaNode.label = label.textContent;

    var children = dispFormula.children;

    for (var i = 0; i < children.length; i++) {
      var child = children[i];
      var type = this.getNodeType(child);

      if (type === "mml:math") {
        // TODO: is it really important to unwrap the mml:row?
        // why not just take the MathML directly?
        // Note: somehow it is not accepted to querySelect with "mml:row"
        var mmlRow = child.firstChild;
        formulaNode.format = "mathml";
        formulaNode.data = _toHtml(mmlRow);
      }
      else if (type === "tex-math") {
        formulaNode.format = "latex";
        formulaNode.data = child.textContent;
      }
    }

    if (formulaNode.format === "") {
      console.error("This formula is not yet supported", dispFormula);
      return null;
    } else {
      doc.create(formulaNode);
      return formulaNode;
    }
  };

  // Citations
  // ---------

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
      } else if (type === "label") {
        // ignoring it here...
      } else {
        console.error("Not supported in 'ref': ", type);
      }
    }
  };

  // TODO: is implemented naively, should be implemented considering the NLM spec
  this.citation = function(state, ref, citation) {
    var doc = state.doc;
    var i;

    var id = ref.getAttribute("id");
    if (!id) {
      throw new ImporterError("Expected 'id' in ref.");
    }

    var citationNode = {
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

    // HACK: we try to create a 'articleCitation' when there is structured
    // content (ATM, when personGroup is present)
    // Otherwise we create a mixed-citation taking the plain text content of the element
    if (personGroup) {

      citationNode = {
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


      var nameElements = personGroup.querySelectorAll("name");
      for (i = 0; i < nameElements.length; i++) {
        citationNode.authors.push(_getName(nameElements[i]));
      }

      var articleTitle = citation.querySelector("article-title");
      if (articleTitle) {
        citationNode.title = articleTitle.textContent;
      } else {
        console.error("FIXME: this citation has no title", citation);
      }

      var source = citation.querySelector("source");
      if (source) citationNode.source = source.textContent;

      var volume = citation.querySelector("volume");
      if (volume) citationNode.volume = volume.textContent;

      var fpage = citation.querySelector("fpage");
      if (fpage) citationNode.fpage = fpage.textContent;

      var lpage = citation.querySelector("lpage");
      if (lpage) citationNode.lpage = lpage.textContent;

      var year = citation.querySelector("year");
      if (year) citationNode.year = year.textContent;

      // Note: the label is child of 'ref'
      var label = ref.querySelector("label");
      if(label) citationNode.label = label.textContent;

      var pubIds = citation.querySelectorAll("pub-id");
      for (i = 0; i < pubIds.length; i++) {
        if(pubIds[i].getAttribute("pub-id-type") === "doi") {
          citationNode.doi = pubIds[i].textContent;
          break;
        }
      }

    } else {
      console.error("FIXME: there is one of those 'mixed-citation' without any structure.", citation);
      citationNode = {
        id: id,
        type: "mixed_citation",
        citation: citation.textContent,
        doi: ""
      };
    }

    doc.create(citationNode);
    doc.show("citations", id);
  };

};

LensImporter.Prototype.prototype = NLMImporter.prototype;
LensImporter.prototype = new LensImporter.Prototype();

module.exports = {
  Importer: LensImporter
};

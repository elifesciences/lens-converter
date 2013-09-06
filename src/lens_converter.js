"use strict";

var _ = require("underscore");
var Converter = require("substance-converter");
var ImporterError = Converter.ImporterError;
var NLMImporter = Converter.NLMImporter;

// Available configurations
// --------

var ElifeConfiguration = require("./configurations/elife");
var LandesConfiguration = require("./configurations/landes");
var DefaultConfiguration = require("./configurations/default");
var PLOSConfiguration = require("./configurations/plos");


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
    // "image": "figures",
    "supplement": "figures",
    "figure": "figures",
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
      } else if (refType === "fig" || refType === "table" || "supplementary-material") {
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

  // Article.ArticleMeta
  // --------

  // this.articleMeta = function(state, articleMeta) {
  //   __super__.articleMeta.call(this, state, articleMeta);
  // }; 


  // Article.Back
  // --------

  // this.back = function(state, back) {
  //   __super__.back.call(this, state, back);
  // };


  // Handle <supplementary-material> element
  // --------
  // 
  // eLife Example:
  // 
  // <supplementary-material id="SD1-data">
  //   <object-id pub-id-type="doi">10.7554/eLife.00299.013</object-id>
  //   <label>Supplementary file 1.</label>
  //   <caption>
  //     <title>Compilation of the tables and figures (XLS).</title>
  //     <p>This is a static version of the 
  //       <ext-link ext-link-type="uri" xlink:href="http://www.vaxgenomics.org/vaxgenomics/" xmlns:xlink="http://www.w3.org/1999/xlink">
  //         Interactive Results Tool</ext-link>, which is also available to download from Zenodo (see major datasets).</p>
  //     <p>
  //       <bold>DOI:</bold>
  //       <ext-link ext-link-type="doi" xlink:href="10.7554/eLife.00299.013">http://dx.doi.org/10.7554/eLife.00299.013</ext-link>
  //     </p>
  //   </caption>
  //   <media mime-subtype="xlsx" mimetype="application" xlink:href="elife00299s001.xlsx"/>
  // </supplementary-material>
  // 
  // LB Example:
  // 
  // <supplementary-material id="SUP1" xlink:href="2012INTRAVITAL024R-Sup.pdf">
  //   <label>Additional material</label>
  //   <media xlink:href="2012INTRAVITAL024R-Sup.pdf"/>
  // </supplementary-material>

  this.supplement = function(state, supplement) {
    var doc = state.doc;
    var that = this;

    //get supplement info
    var id = supplement.getAttribute("id") || state.nextId("supplement");
    var label = supplement.querySelector("label").textContent;

    var url = "http://meh.com";
    var doi = supplement.querySelector("object-id[pub-id-type='doi']");
    doi = doi ? "http://dx.doi.org/" + doi.textContent : "";    

    //create supplement node using file ids
    var supplementNode = {
      "id": id,
      "type": "supplement",
      "label": label,
      "url": url,
      "caption": null
    };

    // Add a caption if available
    var caption = supplement.querySelector("caption");

    if (caption) {
      var captionNode = this.caption(state, caption);
      if (captionNode) supplementNode.caption = captionNode.id;
    }
    
    // Let config enhance the node
    state.config.enhanceSupplement(state, supplementNode, supplement);

    doc.create(supplementNode);
    doc.show("figures", id);
  };

  // Hot patch state object and add configuration object
  // --------
  // 

  this.document = function(state, xmlDoc) {
    var publisherName = state.xmlDoc.querySelector("publisher-name").textContent;
    if (publisherName === "Landes Bioscience") {
      state.config = new LandesConfiguration();
    } else if (publisherName === "eLife Sciences Publications, Ltd") {
      state.config = new ElifeConfiguration();
    } else if (publisherName === "Public Library of Science") {
      state.config = new PLOSConfiguration();
    } else {
      state.config = new DefaultConfiguration();
    }

    // Doc without supplements
    var doc = __super__.document.call(this, state, xmlDoc);

    // <supplementary-material> Supplemental Material, zero or more
    // Queried globally as a post-processing step
    var supplements = state.xmlDoc.querySelectorAll("supplementary-material");

    _.each(supplements, function(supplement) {
      this.supplement(state, supplement);
    }, this);

    return doc;
  };

  // Handle <fig> element
  // --------
  // 

  this.figure = function(state, figure) {
    var doc = state.doc;

    var label = figure.querySelector("label").textContent;

    // Top level figure node
    var figureNode = {
      type: "figure",
      "label": label,
      "url": "http://images.wisegeek.com/young-calico-cat.jpg",
      "caption": null
    };

    var figureId = figure.getAttribute("id") || state.nextId(figureNode.type);
    figureNode.id = figureId;
    
    // Add a caption if available
    var caption = figure.querySelector("caption");
    if (caption) {
      var captionNode = this.caption(state, caption);
      if (captionNode) figureNode.caption = captionNode.id;
    }

    // Lets the configuration patch the figure node properties
    state.config.enhanceFigure(state, figureNode, figure);
    doc.create(figureNode);

    return figureNode;
  };

  // Used by Figure, Table, Video, Supplement types.
  // --------

  this.caption = function(state, caption) {
    var doc = state.doc;
    var title = caption.querySelector("title");
    var paragraphs = caption.querySelectorAll("p");

    // console.log('p.length', p.length);

    if (paragraphs.length === 0) return null;

    var captionNode = {
      "id": caption.getAttribute("id") || state.nextId("caption"),
      "type": "caption",
      "title": "",
      "children": []
    };

    // Titles can be annotated, thus delegate to paragraph
    if (title) {
      // Resolve title by delegating to the paragraph
      var nodes = this.paragraph(state, title);
      if (nodes.length > 0) {
        captionNode.title = nodes[0].id
      }
    }


    var children = [];
    _.each(paragraphs, function(p) {
      // Oliver: Explain, why we need NLMImporter.paragraph to return an array nodes?
      // I would expect it to return just one paragraph node. 
      var nodes = this.paragraph(state, p);
      if (nodes.length > 1) {
        // throw new ImporterError("Ooops. Not ready for that...");
        console.error("Ooops. Not ready for multiple nodes... only using the first one.");
      }
      if (nodes.length > 0) {
        var paragraphNode = nodes[0];
        children.push(paragraphNode.id);
      }
    }, this);

    captionNode.children = children;
    doc.create(captionNode);

    return captionNode;
  };


  this.media = function(state, media) {
    var mimetype = media.getAttribute("mimetype");
    if (mimetype === "video") {
      return this.video(state, media);
    } else {
      console.error("Media type not supported yet: " + mimetype);
      // throw new ImporterError("Media type not supported yet: " + mimetype);
    }
  };

  // <media content-type="glencoe play-in-place height-250 width-310" id="movie1" mime-subtype="mov" mimetype="video" xlink:href="elife00005m001.mov">
  //   <object-id pub-id-type="doi">
  //     10.7554/eLife.00005.013</object-id>
  //   <label>Movie 1.</label>
  //   <caption>
  //     <title>Movement of GFP tag.</title>
  //     <p>
  //       <bold>DOI:</bold>
  //       <ext-link ext-link-type="doi" xlink:href="10.7554/eLife.00005.013">http://dx.doi.org/10.7554/eLife.00005.013</ext-link>
  //     </p>
  //   </caption>
  // </media>

  this.video = function(state, video) {
    var doc = state.doc;

    var label = video.querySelector("label").textContent;

    var id = video.getAttribute("id") || state.nextId("video");
    var videoNode = {
      id: id,
      type: "video",
      label: label,
      title: "",
      caption: null,
      poster: ""
    };

    // Add a caption if available
    var caption = video.querySelector("caption");
    if (caption) {
      var captionNode = this.caption(state, caption);
      if (captionNode) videoNode.caption = captionNode.id;
    }

    state.config.enhanceVideo(state, videoNode, video);
    doc.create(videoNode);

    return videoNode;
  };

  this.tableWrap = function(state, tableWrap) {
    var doc = state.doc;
    var label = tableWrap.querySelector("label").textContent;

    var id = tableWrap.getAttribute("id") || state.nextId("table");
    var tableNode = {
      id: id,
      type: "table",
      title: "",
      label: label,
      content: "",
      caption: null,
      // Not supported yet ... need examples
      footers: [],
      // doi: "" needed?
    };

    // Note: using a DOM div element to create HTML
    var table = tableWrap.querySelector("table");
    tableNode.content = _toHtml(table);

    // Add a caption if available
    var caption = table.querySelector("caption");
    if (caption) {
      var captionNode = this.caption(state, caption);
      if (captionNode) tableNode.caption = captionNode.id;
    }

    state.config.enhanceTable(state, tableNode, tableWrap);
    doc.create(tableNode);
    return tableNode;
  };

  // Formula Node Type
  // --------

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

      var doi = citation.querySelector("pub-id[pub-id-type='doi'], ext-link[ext-link-type='doi']");
      if(doi) citationNode.doi = "http://dx.doi.org/" + doi.textContent;       
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

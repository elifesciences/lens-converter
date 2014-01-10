"use strict";

//var DefaultConfiguration = require('./default');
var util = require("substance-util");
var _ = require("underscore");

var DefaultConfiguration = function() {

};

DefaultConfiguration.Prototype = function() {


  this.enhanceSupplement = function(state, node, element) {
    // Noop - override in your configuration
  };

  this.enhanceTable = function(state, node, element) {
    // Noop - override in your configuration
  };

  this.enhanceCover = function(state, node, element) {
    // Noop - override in your configuration
  };

  // Get baseURL either from XML or from the converter options
  // --------
  // 

  this.getBaseURL = function(state) {
    // Use xml:base attribute if present
    var baseURL = state.xmlDoc.querySelector("article").getAttribute("xml:base");
    return baseURL || state.options.baseURL;
  };

  // Default video resolver
  // --------
  // 

  this.enhanceVideo = function(state, node, element) {
    var el = element.querySelector("media") || element;
    // xlink:href example: elife00778v001.mov
    
    var url = element.getAttribute("xlink:href");
    // Just return absolute urls
    if (url.match(/http:/)) {
      var lastdotIdx = url.lastIndexOf(".");
      var name = url.substring(0, lastdotIdx);
      node.url = name+".mp4";
      node.url_ogv = name+".ogv";
      node.url_webm = name+".webm";
      node.poster = name+".png";
      return;
    } else {
      var baseURL = this.getBaseURL(state);
      var name = url.split(".")[0];
      node.url = baseURL+name+".mp4";
      node.url_ogv = baseURL+name+".ogv";
      node.url_webm = baseURL+name+".webm";
      node.poster = baseURL+name+".png";
    }
  };

  // Implements resolving of relative urls
  this.enhanceFigure = function(state, node, element) {
    // var graphic = element.querySelector("graphic");
    // var url = graphic.getAttribute("xlink:href");
    // node.url = this.resolveURL(state, url);
  };

  this.enhanceArticle = function(converter, state, article) {
    // Noop - override in your configuration
  };

  this.extractPublicationInfo = function(converter, state, article) {
    var doc = state.doc;

    var articleMeta = article.querySelector("article-meta");
    
    function _extractDate(dateEl) {
      if (!dateEl) return null;
      var day = dateEl.querySelector("day").textContent;
      var month = dateEl.querySelector("month").textContent;
      var year = dateEl.querySelector("year").textContent;
      return [year, month, day].join("-");
    }
    
    // Publication dates
    var pubDate = articleMeta.querySelector("pub-date[pub-type=epub]");
    var receivedDate = articleMeta.querySelector("date[date-type=received]");
    var acceptedDate = articleMeta.querySelector("date[date-type=accepted]");

    // PDF and XML link
    var pmcID = article.querySelector("article-id[pub-id-type=pmc]").textContent;
    var xmlLink = [
      "http://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pmc&id=",
      pmcID
    ].join('');

    var pdfLink = [
        "http://europepmc.org/articles/PMC",
        pmcID,
        "?pdf=render"
      ].join('');

    var articleType = articleMeta.querySelector("subj-group[subj-group-type=heading] subject");
    // Check to see if the full XML is available
    var body = article.querySelector("body");
    var journalTitle = article.querySelector("journal-title");

    if (body) {
      
      // <article-id pub-id-type="doi">10.1371/journal.pcbi.1002724</article-id>
      var articleDOI = article.querySelector("article-id[pub-id-type=doi]");
      //var pubID = article.querySelector("article-id[pub-id-type=publisher-id]").textContent;

      // Get Figure URLS
      var figs  = doc["nodes"]["figures"]["nodes"];
      for (var j=0;j<figs.length;j++) {
        var figid = figs[j];
        var id = doc["nodes"][figid]["attrib"];
        var url = [
          "http://www.ncbi.nlm.nih.gov/pmc/articles/PMC",
          pmcID,
          /bin/,
          id,
          ".jpg"
        ].join('');
        doc["nodes"][figid]["url"] = url;
      }
      
    }
    // Create PublicationInfo node
    // ---------------
    
    var pubInfoNode = {
      "id": "publication_info",
      "type": "publication_info",
      "published_on": _extractDate(pubDate),
      "received_on": _extractDate(receivedDate),
      "accepted_on": _extractDate(acceptedDate),
      //"keywords": _.pluck(keyWords, "textContent"),
      // "research_organisms": _.pluck(organisms, "textContent"),
      // "subjects": _.pluck(subjects, "textContent"),
      "article_type": articleType ? articleType.textContent : "",
      "journal": journalTitle ? journalTitle.textContent : "",
      "pdf_link": pdfLink,
      //"related_article": relatedArticle ? ["http://dx.doi.org/", relatedArticle.getAttribute("xlink:href")].join("") : "",
      "xml_link": xmlLink,
      //"json_link": "http://mickey.com/mouse.json",
      "doi": articleDOI ? ["http://dx.doi.org/", articleDOI.textContent].join("") : "",
    };
    doc.create(pubInfoNode);
    doc.show("info", pubInfoNode.id, 0);
  };

  this.resolveURL = function(url) {
    return url;
  };

  // Default figure url resolver
  // --------
  // 
  // For relative urls it uses the same basebath as the source XML

  this.resolveURL = function(state, url) {
    // Just return absolute urls
    if (url.match(/http:/)) return url;
    return [
      state.options.baseURL,
      url
    ].join('');
  };
};

DefaultConfiguration.prototype = new DefaultConfiguration.Prototype();
module.exports = DefaultConfiguration;

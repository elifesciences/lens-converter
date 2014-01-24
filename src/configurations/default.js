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
      try {
        var day = dateEl.querySelector("day").textContent;
        var month = dateEl.querySelector("month").textContent;
        var year = dateEl.querySelector("year").textContent;
        return [year, month, day].join("-");
      }
      catch (TypeError) {
        var month = dateEl.querySelector("month").textContent;
        var year = dateEl.querySelector("year").textContent;
        return [year, month].join("-");
      }
    }
    
    // Publication dates
    var pubDate = articleMeta.querySelector("pub-date[pub-type=epub]");
    if (!pubDate) var pubDate = articleMeta.querySelector("pub-date[pub-type=ppub]");
    var receivedDate = articleMeta.querySelector("date[date-type=received]");
    var acceptedDate = articleMeta.querySelector("date[date-type=accepted]");

    // PDF and XML link
    var pmID = article.querySelector("article-id[pub-id-type=pmid]");
    var pmcID = article.querySelector("article-id[pub-id-type=pmc]").textContent;
    var pubID = article.querySelector("article-id[pub-id-type=publisher-id]");
    var xmlLink = [
      "http://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pmc&id=",
      pmcID
    ].join('');


    var articleType = articleMeta.querySelector("subj-group[subj-group-type=heading] subject").textContent;
    // Check to see if the full XML is available
    var body = article.querySelector("body");
    var fig = article.querySelector("fig");
    var journalTitle = article.querySelector("journal-title");
    var articleDOI = article.querySelector("article-id[pub-id-type=doi]");

    if (body || fig) {
      
      // PDF Link

      var pdfLink = [
        "http://europepmc.org/articles/PMC",
        pmcID,
        "?pdf=render"
      ].join('');

      // <article-id pub-id-type="doi">10.1371/journal.pcbi.1002724</article-id>
      
      //var pubID = article.querySelector("article-id[pub-id-type=publisher-id]").textContent;

      // Get Figure URLS
      var figs  = doc["nodes"]["figures"]["nodes"];
      for (var j=0;j<figs.length;j++) {
        var figid = figs[j];
        if (doc["nodes"][figid]["type"] === "figure") {
          if (doc["nodes"][figid]["source_id"].indexOf('video') >= 0){
            doc["nodes"][figid]["type"] = "video";
            var id = article.querySelector("#"+doc["nodes"][figid]["source_id"]);
            var media = id.querySelector("media")
            var xlink = media.getAttribute("xlink:href")
            var url = [
              "http://www.ncbi.nlm.nih.gov/pmc/articles/PMC",
              pmcID,
              /bin/,
              xlink
            ].join('');
            doc["nodes"][figid]["url"] = url;
            doc["nodes"][figid]["url_ogv"] = url;
            doc["nodes"][figid]["url_web,"] = url;
            doc["nodes"][figid]["poster"] = url;
            continue
          }
          var id = doc["nodes"][figid]["attrib"];
          doc["nodes"][figid]["attrib"] = "";
          var url = [
            "http://www.ncbi.nlm.nih.gov/pmc/articles/PMC",
            pmcID,
            /bin/,
            id,
            ".jpg"
          ].join('');
          doc["nodes"][figid]["url"] = url;
        }
        else if (doc["nodes"][figid]["type"] === "supplement") {
          var id = doc["nodes"][figid]["url"];
          var url = [
            "http://www.ncbi.nlm.nih.gov/pmc/articles/PMC",
            pmcID,
            /bin/,
            id
          ].join('');
          console.log(url)
          console.log(doc["nodes"][figid])
          doc["nodes"][figid]["properties"]["url"] = url;
        }
      }
      
    }
    else {
      articleType += ': Not a true Open Access Article. Full XML is unavailable because of the publisher.'
    }
    // Create PublicationInfo node
    // ---------------
    
    var pubInfoNode = {
      "id": "publication_info",
      "type": "publication_info",
      "published_on": _extractDate(pubDate),
      "received_on": _extractDate(receivedDate),
      "accepted_on": _extractDate(acceptedDate),
      "pmid" : pmID ? pmID.textContent : "",
      "pmcid" : pmcID,
      "pubid" : pubID ? pubID.textContent : "",
      //"keywords": _.pluck(keyWords, "textContent"),
      // "research_organisms": _.pluck(organisms, "textContent"),
      // "subjects": _.pluck(subjects, "textContent"),
      "article_type": articleType,
      "journal": journalTitle ? journalTitle.textContent : "",
      "pdf_link": pdfLink ? pdfLink : ["http://www.ncbi.nlm.nih.gov/pmc/articles/PMC",pmcID].join(""),
      //"related_article": relatedArticle ? ["http://dx.doi.org/", relatedArticle.getAttribute("xlink:href")].join("") : "",
      "xml_link": xmlLink,
      //"json_link": "http://mickey.com/mouse.json",
      "doi": articleDOI ? ["http://dx.doi.org/", articleDOI.textContent].join("") : "",
    };

    // Add affiliations and emails to authors if missing

    // Do affiliation nodes exist?
    var affids = []
    for (var key in doc["nodes"]) {
      if (doc["nodes"][key].type === 'affiliation') {
        affids.push(doc["nodes"][key].id)
      }
    }

    // If affiliations don't exist, build them
    if (affids.length < 1) {
      var affNode = {
        "type": "affiliation",
        "id": "",
        "source_id": "",
        "city": "",
        "country": "",
        "department": "",
        "institution": "",
        "label": ""
      };

      var affs = article.querySelectorAll('aff');
      for (var affnum=0;affnum<affs.length;affnum++) {
        affNode.source_id = affs[affnum].getAttribute('id');
        affNode.id = state.nextId("affiliation");

        var label = affs[affnum].querySelector('label');
        var sup = affs[affnum].querySelector('sup');
        if (label) {
          affNode.label = label.textContent;
          affNode.institution = affs[affnum].textContent.replace(affNode.label,"");
        }
        else if (sup){
          affNode.label = sup.textContent;
          affNode.institution = affs[affnum].textContent.replace(affNode.label,"");
        }

        doc.create(affNode);
      }
    }  

    var authors = article.querySelectorAll('contrib[contrib-type=author]');
    for (var ath=0;ath<authors.length;ath++) {

      // Get existing author ID
      var currentid = doc["nodes"]["document"]["authors"][ath];

      // Add email if it exists
      var email = authors[ath].querySelector('email');
      if (email) doc["nodes"][currentid]["emails"].push(email.textContent);

      // Add affiliations
      var aff = authors[ath].querySelectorAll('xref');
      for (var affnum=0;affnum<aff.length;affnum++){
        var id = aff[affnum].getAttribute('rid');
        if (!id){
          var id = 'aff'+aff[affnum].textContent;
        }
        if (id.indexOf('cor') >= 0) {
          var email = article.querySelector("corresp[id="+id+"] email");
          if (email) {
            if (doc["nodes"][currentid]["emails"].indexOf(email.textContent) < 0) {
              doc["nodes"][currentid]["emails"].push(email.textContent);
            }
          }
        }
        for (var key in doc["nodes"]) {
          if (doc["nodes"][key].source_id === id) {
            var stateid = doc["nodes"][key].id;
            if (doc["nodes"][currentid]["affiliations"].indexOf(stateid) < 0){
              doc["nodes"][currentid]["affiliations"].push(stateid)
            }
            break
          }
        }
      }
    }
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

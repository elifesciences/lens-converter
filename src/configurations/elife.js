"use strict";

var util = require("substance-util");
var _ = require("underscore");
var DefaultConfiguration = require('./default');

var ElifeConfiguration = function() {

};

ElifeConfiguration.Prototype = function() {

  // Add Decision letter and author response
  // ---------

  this.enhanceArticle = function(converter, state, article) {
    var nodes = [];
    var doc = state.doc;
    var heading, body;

    // Decision letter (if available)
    // -----------

    var articleCommentary = article.querySelector("#SA1");
    if (articleCommentary) {
      heading = {
        id: state.nextId("heading"),
        type: "heading",
        level: 1,
        content: "Article Commentary"
      };
      doc.create(heading);
      nodes.push(heading);

      heading = {
        id: state.nextId("heading"),
        type: "heading",
        level: 2,
        content: "Decision letter"
      };
      doc.create(heading);
      nodes.push(heading);

      body = articleCommentary.querySelector("body");
      nodes = nodes.concat(converter.bodyNodes(state, util.dom.getChildren(body)));
    }

    // Author response
    // -----------

    var authorResponse = article.querySelector("#SA2");
    if (authorResponse) {

      heading = {
        id: state.nextId("heading"),
        type: "heading",
        level: 2,
        content: "Author response"
      };
      doc.create(heading);
      nodes.push(heading);

      body = authorResponse.querySelector("body");
      nodes = nodes.concat(converter.bodyNodes(state, util.dom.getChildren(body)));
    }

    // Show them off
    // ----------

    if (nodes.length > 0) {
      converter.show(state, nodes);
    }

    this.enhanceInfo(converter, state, article);
  };

  this.enhanceCover = function(state, node, element) {
    var category;
    var dispChannel = element.querySelector("subj-group[subj-group-type=display-channel] subject").textContent;
    try {
      category = element.querySelector("subj-group[subj-group-type=heading] subject").textContent;
    } catch(err) {
      category = null;
    }

    node.breadcrumbs = [
      { name: "eLife", url: "http://elifesciences.org/", image: "http://lens.elifesciences.org/lens-elife/styles/elife.png" },
      { name: dispChannel, url: "http://elifesciences.org/category/"+dispChannel.replace(/ /g, '-').toLowerCase() },
    ];

    if (category) node.breadcrumbs.push( { name: category, url: "http://elifesciences.org/category/"+category.replace(/ /g, '-').toLowerCase() } );
  };

  // Resolves figure url
  // --------
  //

  this.enhanceFigure = function(state, node, element) {
    var graphic = element.querySelector("graphic");
    var url = graphic.getAttribute("xlink:href");
    node.url = this.resolveURL(state, url);
  };

  // Add additional information to the info view
  // ---------
  //

  this.enhancePublicationInfo = function(state, publicationInfo) {
    var article = state.xmlDoc.querySelector("article");
    var articleMeta = article.querySelector("article-meta");

    // Extract research organism
    // ------------
    //

    // <kwd-group kwd-group-type="research-organism">
    // <title>Research organism</title>
    // <kwd>B. subtilis</kwd>
    // <kwd>D. melanogaster</kwd>
    // <kwd>E. coli</kwd>
    // <kwd>Mouse</kwd>
    // </kwd-group>
    var organisms = articleMeta.querySelectorAll("kwd-group[kwd-group-type=research-organism] kwd");

    // Extract keywords
    // ------------
    //
    // <kwd-group kwd-group-type="author-keywords">
    //  <title>Author keywords</title>
    //  <kwd>innate immunity</kwd>
    //  <kwd>histones</kwd>
    //  <kwd>lipid droplet</kwd>
    //  <kwd>anti-bacterial</kwd>
    // </kwd-group>
    var keyWords = articleMeta.querySelectorAll("kwd-group[kwd-group-type=author-keywords] kwd");

    // Extract subjects
    // ------------
    //
    // <subj-group subj-group-type="heading">
    // <subject>Immunology</subject>
    // </subj-group>
    // <subj-group subj-group-type="heading">
    // <subject>Microbiology and infectious disease</subject>
    // </subj-group>

    var subjects = articleMeta.querySelectorAll("subj-group[subj-group-type=heading] subject");

    // Article Type
    //
    // <subj-group subj-group-type="display-channel">
    //   <subject>Research article</subject>
    // </subj-group>

    var articleType = articleMeta.querySelector("subj-group[subj-group-type=display-channel] subject");

    // Extract PDF link
    // ---------------
    //
    // <self-uri content-type="pdf" xlink:href="elife00007.pdf"/>

    var pdfURI = article.querySelector("self-uri[content-type=pdf]");

    var pdfLink = [
      "http://cdn.elifesciences.org/elife-articles/",
      state.doc.id,
      "/pdf/",
      pdfURI ? pdfURI.getAttribute("xlink:href") : "#"
    ].join('');

    // Collect Links
    // ---------------

    var links = [];

    if (pdfLink) {
      links.push({
        url: pdfLink,
        name: "PDF",
        type: "pdf"
      });
    }

    links.push({
      url: "https://s3.amazonaws.com/elife-cdn/elife-articles/"+state.doc.id+"/elife"+state.doc.id+".xml",
      name: "Source XML",
      type: "xml"
    });

    // Add JSON Link

    links.push({
      url: "", // will be auto generated
      name: "Lens JSON",
      type: "json"
    });


    publicationInfo.research_organisms = _.pluck(organisms, "textContent");
    publicationInfo.keywords = _.pluck(keyWords, "textContent");
    publicationInfo.subjects = _.pluck(subjects, "textContent");
    publicationInfo.article_type = articleType ? articleType.textContent : "";
    publicationInfo.links = links;

    if (publicationInfo.related_article) publicationInfo.related_article = "http://dx.doi.org/" + publicationInfo.related_article;
  };


  this.enhanceSupplement = function(state, node) {
    var baseURL = this.getBaseURL(state);
    if (baseURL) {
      return [baseURL, node.url].join('');
    } else {
      node.url = [
        "http://cdn.elifesciences.org/elife-articles/",
        state.doc.id,
        "/suppl/",
        node.url
      ].join('');
    }
  };

  this.enhanceVideo = function(state, node, element) {
    var href = element.getAttribute("xlink:href").split(".");
    var name = href[0];
    node.url = "http://static.movie-usa.glencoesoftware.com/mp4/10.7554/"+name+".mp4";
    node.url_ogv = "http://static.movie-usa.glencoesoftware.com/ogv/10.7554/"+name+".ogv";
    node.url_webm = "http://static.movie-usa.glencoesoftware.com/webm/10.7554/"+name+".webm";
    node.poster = "http://static.movie-usa.glencoesoftware.com/jpg/10.7554/"+name+".jpg";
  };


  // Example url to JPG: http://cdn.elifesciences.org/elife-articles/00768/svg/elife00768f001.jpg
  this.resolveURL = function(state, url) {
    // Use absolute URL
    if (url.match(/http:\/\//)) return url;

    // Look up base url
    var baseURL = this.getBaseURL(state);

    if (baseURL) {
      return [baseURL, url].join('');
    } else {
      // Use special URL resolving for production articles
      return [
        "http://cdn.elifesciences.org/elife-articles/",
        state.doc.id,
        "/jpg/",
        url,
        ".jpg"
      ].join('');
    }
  };

};

ElifeConfiguration.Prototype.prototype = DefaultConfiguration.prototype;
ElifeConfiguration.prototype = new ElifeConfiguration.Prototype();
ElifeConfiguration.prototype.constructor = ElifeConfiguration;

module.exports = ElifeConfiguration;

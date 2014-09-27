"use strict";

var util = require("substance-util");
var _ = require("underscore");
var DefaultConfiguration = require('./default');

var ElifeConfiguration = function() {

};

ElifeConfiguration.Prototype = function() {

  this.enhanceCover = function(state, node, element) {
    var dispChannel = element.querySelector("subj-group[subj-group-type=display-channel] subject").textContent;
    try {
      var category = element.querySelector("subj-group[subj-group-type=heading] subject").textContent;
    } catch(err) {
      var category = null;
    }
    
    node.breadcrumbs = [
      { name: "eLife", url: "http://elife.elifesciences.org/", image: "http://lens.elifesciences.org/lens-elife/styles/elife.png" },
      { name: dispChannel, url: "http://elife.elifesciences.org/category/"+dispChannel.replace(/ /g, '-').toLowerCase() },
    ];
    
    if (category) node.breadcrumbs.push( { name: category, url: "http://elife.elifesciences.org/category/"+category.replace(/ /g, '-').toLowerCase() } );
  };

  // Resolves figure url
  // --------
  //

  this.enhanceFigure = function(state, node, element) {
    var graphic = element.querySelector("graphic");
    var url = graphic.getAttribute("xlink:href");
    node.url = this.resolveURL(state, url);
  };

  this.enhanceVideo = function(state, node, element) {
    var el = element.querySelector("media") || element;
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

  this.enhanceSupplement = function(state, node, element) {
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

  this.extractPublicationInfo = function(converter, state, article) {
    var doc = state.doc;

    // Initialize the Article Info object
    var articleInfo = {
      "id": "articleinfo",
      "type": "paragraph",
      "children": []
    };
    var nodes = articleInfo.children;

    // Get the author's impact statement
    var meta = article.querySelectorAll("meta-value");
    var impact = meta[1];
    
    if (impact) {
      var h1 = {
        "type": "heading",
        "id": state.nextId("heading"),
        "level": 3,
        "content": "Impact",
      };
      doc.create(h1);
      nodes.push(h1.id);

      var par = converter.paragraphGroup(state, impact);
      nodes.push(par[0].id);
    }

    // Get reviewing editor
    // --------------

    var editor = article.querySelector("contrib[contrib-type=editor]");

    if (editor) {
      var name = converter.getName(editor.querySelector('name'));
      var inst = editor.querySelector("institution").textContent;
      var role = editor.querySelector("role").textContent;
      var country = editor.querySelector("country").textContent;

      var h1 = {
        "type": "heading",
        "id": state.nextId("heading"),
        "level": 3,
        "content": "Reviewing Editor"
      };
      
      doc.create(h1);
      nodes.push(h1.id);

      var t1 = {
        "type": "text",
        "id": state.nextId("text"),
        "content": [name, role, inst, country].join(", ")
      };

      doc.create(t1);
      nodes.push(t1.id);      
    }

    // Get major datasets

    var datasets = article.querySelectorAll('sec');

    for (var i = 0;i <datasets.length;i++){
      var data = datasets[i];
      var type = data.getAttribute('sec-type');
      if (type === 'datasets') {
        var h1 = {
          "type" : "heading",
          "id" : state.nextId("heading"),
          "level" : 3,
          "content" : "Major Datasets"
        };
        doc.create(h1);
        nodes.push(h1.id);
        var ids = converter.datasets(state, util.dom.getChildren(data));
        for (var j=0;j < ids.length;j++) {
          if (ids[j]) {
            nodes.push(ids[j]);
          }
        }
      }
    }

    // Get acknowledgements

    var ack = article.querySelector("ack");
    if (ack) {
      var h1 = {
        "type" : "heading",
        "id" : state.nextId("heading"),
        "level" : 3,
        "content" : "Acknowledgements"
      };
      doc.create(h1);
      nodes.push(h1.id);
      var par = converter.bodyNodes(state, util.dom.getChildren(ack));
      nodes.push(par[0].id);
    }
    
    // Get copyright and license information
    var license = article.querySelector("permissions");
    if (license) {
      var h1 = {
        "type" : "heading",
        "id" : state.nextId("heading"),
        "level" : 3,
        "content" : "Copyright and License"
      };
      doc.create(h1);
      nodes.push(h1.id);

      var copyright = license.querySelector("copyright-statement");
      if (copyright) {
        var par = converter.paragraphGroup(state, copyright);
        var textid = par[0].children[0];
        doc.nodes[textid].content += ". ";
        nodes.push(par[0].id);
      }
      var lic = license.querySelector("license");
      var children = util.dom.getChildren(lic);
      for (var i = 0;i < children.length;i++) {
        var child = children[i];
        var type = util.dom.getNodeType(child);
        if (type === 'p' || type === 'license-p') {
          var par = converter.paragraphGroup(state, child);
          nodes.push(par[0].id)
        }
      }
    }
    
    doc.create(articleInfo);

    // ========================================

    var articleMeta = article.querySelector("article-meta");

    function _extractDate(dateEl) {
      if (!dateEl) return null;
      var day = dateEl.querySelector("day").textContent;
      var month = dateEl.querySelector("month").textContent;
      var year = dateEl.querySelector("year").textContent;
      return [year, month, day].join("-");
    }

    var pubDate = articleMeta.querySelector("pub-date");
    var receivedDate = articleMeta.querySelector("date[date-type=received]");
    var acceptedDate = articleMeta.querySelector("date[date-type=accepted]");

    // Extract keywords
    // ------------
    //
    // <kwd-group kwd-group-type="author-keywords">
    // <title>Author keywords</title>
    // <kwd>innate immunity</kwd>
    // <kwd>histones</kwd>
    // <kwd>lipid droplet</kwd>
    // <kwd>anti-bacterial</kwd>
    // </kwd-group>
    var keyWords = articleMeta.querySelectorAll("kwd-group[kwd-group-type=author-keywords] kwd");

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

    // Extract article_type
    // ---------------
    //
    // <subj-group subj-group-type="display-channel">
    // <subject>Research article</subject>
    // </subj-group>

    var articleType = articleMeta.querySelector("subj-group[subj-group-type=display-channel] subject");

    // Extract journal title
    // ---------------
    //

    var journalTitle = article.querySelector("journal-title");

    // <article-id pub-id-type="doi">10.7554/eLife.00003</article-id>
    var articleDOI = article.querySelector("article-id[pub-id-type=doi]");


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


    // Related article if exists
    // -----------

    var relatedArticle = article.querySelector("related-article");


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

    // Create PublicationInfo node
    // ---------------
    
    var pubInfoNode = {
      "id": "publication_info",
      "type": "publication_info",
      "published_on": _extractDate(pubDate),
      "received_on": _extractDate(receivedDate),
      "accepted_on": _extractDate(acceptedDate),
      "keywords": _.pluck(keyWords, "textContent"),
      "research_organisms": _.pluck(organisms, "textContent"),
      "subjects": _.pluck(subjects, "textContent"),
      "article_type": articleType ? articleType.textContent : "",
      "journal": journalTitle ? journalTitle.textContent : "",
      "related_article": relatedArticle ? ["http://dx.doi.org/", relatedArticle.getAttribute("xlink:href")].join("") : "",
      "doi": articleDOI ? ["http://dx.doi.org/", articleDOI.textContent].join("") : "",
      "article_info": articleInfo.id,
      "links": links
    };



    doc.create(pubInfoNode);
    doc.show("info", pubInfoNode.id, 0);
  };


  // Add additional information to the info view
  // ---------
  //
  // Impact
  // Reviewing Editor
  // Major datasets
  // Acknowledgements
  // Copyright

  this.enhanceInfo = function(converter, state, article) {
    // doc.show("info", articleInfo.id);
  };

  // Add Decision letter and author response
  // ---------

  this.enhanceArticle = function(converter, state, article) {

    var nodes = [];

    // Decision letter (if available)
    // -----------

    var articleCommentary = article.querySelector("#SA1");
    if (articleCommentary) {

      var heading = {
        id: state.nextId("heading"),
        type: "heading",
        level: 1,
        content: "Article Commentary"
      };
      doc.create(heading);
      nodes.push(heading);

      var heading = {
        id: state.nextId("heading"),
        type: "heading",
        level: 2,
        content: "Decision letter"
      };
      doc.create(heading);
      nodes.push(heading);

      var body = articleCommentary.querySelector("body");
      nodes = nodes.concat(converter.bodyNodes(state, util.dom.getChildren(body)));
    }

    // Author response
    // -----------

    var authorResponse = article.querySelector("#SA2");
    if (authorResponse) {

      var heading = {
        id: state.nextId("heading"),
        type: "heading",
        level: 2,
        content: "Author response"
      };
      doc.create(heading);
      nodes.push(heading);

      var body = authorResponse.querySelector("body");
      nodes = nodes.concat(converter.bodyNodes(state, util.dom.getChildren(body)));
    }

    // Show them off
    // ----------

    if (nodes.length > 0) {
      converter.show(state, nodes);
    }

    this.enhanceInfo(converter, state, article);
  };
};

ElifeConfiguration.Prototype.prototype = DefaultConfiguration.prototype;
ElifeConfiguration.prototype = new ElifeConfiguration.Prototype();
ElifeConfiguration.prototype.constructor = ElifeConfiguration;

module.exports = ElifeConfiguration;

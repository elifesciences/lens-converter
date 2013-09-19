"use strict";

var util = require("substance-util");

var DefaultConfiguration = require('./default');

var ElifeConfiguration = function() {

};

ElifeConfiguration.Prototype = function() {

  // Resolves figure url
  // --------
  //

  this.enhanceFigure = function(state, node, element) {
    var graphic = element.querySelector("graphic");
    var url = graphic.getAttribute("xlink:href");

    // Example url to SVG: http://cdn.elifesciences.org/elife-articles/00768/svg/elife00768f001.svg
    url = [
      "http://cdn.elifesciences.org/elife-articles/",
      state.doc.id,
      "/svg/",
      url,
      ".svg"
    ].join('');

    node.url = url;
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

  // Add additional information to the info view
  // ---------
  //
  // Impact
  // Major datasets
  // Acknowledgements
  // Copyright

  this.enhanceInfo = function(converter, state, article) {
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
    
    var h1 = {
      "type": "heading",
      "id": state.nextId("heading"),
      "level": 1,
      "content": "Impact",
    };
    doc.create(h1);
    nodes.push(h1.id);
    var t1 = {
      "type" : "text",
      "id" : state.nextId("text"),
      "content" : impact.textContent
    };
    doc.create(t1)
    nodes.push(t1.id)
   
    

    // Get conflict of interest

    var conflict = article.querySelectorAll("fn");
    for (var i = 0; i < conflict.length;i++) {
      var indiv = conflict[i];
      var type = indiv.getAttribute("fn-type");
      if (type === 'conflict') {
        var h1 = {
        "type" : "heading",
        "id" : state.nextId("heading"),
        "level" : 1,
        "content" : "Competing Interests"
      };
      doc.create(h1);
      nodes.push(h1.id);
      var par = converter.bodyNodes(state, util.dom.getChildren(indiv));
      nodes.push(par[0].id);
      }
    }

    // Get major datasets

    var datasets = article.querySelectorAll('sec');
    for (var i = 0;i <datasets.length;i++){
      var data = datasets[i];
      var type = data.getAttribute('sec-type');
      if (type === 'datasets') {
        console.log('getting data')
        var h1 = {
          "type" : "heading",
          "id" : state.nextId("heading"),
          "level" : 1,
          "content" : "Major Datasets"
        };
        doc.create(h1);
        nodes.push(h1.id);
        var ids = converter.datasets(state, util.dom.getChildren(data));
        for (var j=0;j < ids.length;j++) {
          if (!ids[j]) {
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
        "level" : 1,
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
        "level" : 1,
        "content" : "Copyright and License"
      };
      doc.create(h1);
      nodes.push(h1.id);

      var copyright = license.querySelector("copyright-statement");
      if (copyright) {
        var t1 = {
          "type" : "text",
          "id" : state.nextId("text"),
          "content" : copyright.textContent
        };
        doc.create(t1);
        nodes.push(t1.id);
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
    
    //nodes = nodes.concat(converter.bodyNodes(state, util.dom.getChildren(body)));
    doc.create(articleInfo);
    console.log(JSON.stringify(articleInfo));
    doc.show("info", articleInfo.id);
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

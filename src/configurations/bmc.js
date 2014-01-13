"use strict";

var util = require("substance-util");
var _ = require("underscore");
var DefaultConfiguration = require('./default');

var BMCConfiguration = function() {

};

BMCConfiguration.Prototype = function() {
  // this.enhanceCover = function(state, node, element) {
  //   var dispChannel = element.querySelector("subj-group[subj-group-type=heading] subject").textContent;
  //   var category = element.querySelector("subj-group[subj-group-type=Discipline-v2] subject").textContent;

  //   node.breadcrumbs = [
  //     { name: "BMC", url: "http://elife.elifesciences.org/", image: "http://lens.elifesciences.org/lens-elife/styles/elife.png" },
  //     { name: dispChannel, url: "http://elife.elifesciences.org/category/"+dispChannel.replace(/ /g, '-').toLowerCase() },
  //     { name: category, url: "http://elife.elifesciences.org/category/"+category.replace(/ /g, '-').toLowerCase() },
  //   ];
  // };

  

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

    var pubDate = articleMeta.querySelector("pub-date[pub-type=epub]");
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
    var keyWords = articleMeta.querySelectorAll("kwd");

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
    //var organisms = articleMeta.querySelectorAll("kwd-group[kwd-group-type=research-organism] kwd");

    // Extract subjects
    // ------------
    //
    // <subj-group subj-group-type="heading">
    // <subject>Immunology</subject>
    // </subj-group>
    // <subj-group subj-group-type="heading">
    // <subject>Microbiology and infectious disease</subject>
    // </subj-group>

    //var subjects = articleMeta.querySelectorAll("subj-group[subj-group-type=heading] subject");

    // Extract article_type
    // ---------------
    //
    // <subj-group subj-group-type="display-channel">
    // <subject>Research article</subject>
    // </subj-group>

    var articleType = articleMeta.querySelector("subj-group[subj-group-type=heading] subject");

    // Extract journal title
    // ---------------
    //

    var journalTitle = article.querySelector("journal-id[journal-id-type=nlm-ta]");

    // <article-id pub-id-type="doi">10.1371/journal.pcbi.1002724</article-id>
    var articleDOI = article.querySelector("article-id[pub-id-type=doi]");
    var pmcID = article.querySelector("article-id[pub-id-type=pmc]").textContent;
    var pubID = article.querySelector("article-id[pub-id-type=publisher-id]").textContent;

    // Get Figure URLS
    var figs  = doc["nodes"]["figures"]["nodes"];
    for (var j=0;j<figs.length;j++) {
      var figid = figs[j];
      if (doc["nodes"][figid]["type"] === "figure") {
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
    
    // Extract PDF link
    // ---------------
    //
    // <self-uri content-type="pdf" xlink:href="elife00007.pdf"/>
    
    var pdfLink = [
      "http://www.ncbi.nlm.nih.gov/pmc/articles/PMC",
      pmcID,
      "/pdf/",
      pubID,
      ".pdf"
    ].join('');

    var xmlLink = [
      "http://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pmc&id=",
      pmcID
    ].join('');

    // Related article if exists
    // -----------

    var relatedArticle = article.querySelector("related-article");


    // if (relatedArticle) relatedArticle = relatedArticle.getAttribute("xlink:href");

    // Create PublicationInfo node
    // ---------------
    
    var pubInfoNode = {
      "id": "publication_info",
      "type": "publication_info",
      "published_on": _extractDate(pubDate),
      "received_on": _extractDate(receivedDate),
      "accepted_on": _extractDate(acceptedDate),
      "keywords": _.pluck(keyWords, "textContent"),
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


  // Add additional information to the info view
  // ---------
  //
  // Impact
  // Reviewing Editor
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
    // var meta = article.querySelectorAll("meta-value");
    // var impact = meta[1];
    // if (impact) {
    //   var h1 = {
    //     "type": "heading",
    //     "id": state.nextId("heading"),
    //     "level": 3,
    //     "content": "Impact",
    //   };
    //   doc.create(h1);
    //   nodes.push(h1.id);
      
    //   var par = converter.paragraphGroup(state, impact);
    //   nodes.push(par[0].id);
    // }

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
        if (label) affNode.label = label.textContent;

        affNode.institution = affs[affnum].textContent.replace(affNode.label,"");

        doc.create(affNode);
      }
    }  

    var authors = article.querySelectorAll('contrib[contrib-type=author]');
    for (var ath=0;ath<authors.length;ath++) {

      // Get existing author ID
      var currentid = doc["nodes"]["document"]["authors"][ath];
      console.log(currentid)
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
          if (doc["nodes"][currentid]["emails"].indexOf(email.textContent) < 0) {
            doc["nodes"][currentid]["emails"].push(email.textContent);
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
    
    // Get conflict of interest

    // var conflict = article.querySelectorAll("fn");
    // for (var i = 0; i < conflict.length;i++) {
    //   var indiv = conflict[i];
    //   var type = indiv.getAttribute("fn-type");
    //     if (type === 'conflict') {
    //       var h1 = {
    //       "type" : "heading",
    //       "id" : state.nextId("heading"),
    //       "level" : 1,
    //       "content" : "Competing Interests"
    //     };
    //     doc.create(h1);
    //     nodes.push(h1.id);
    //     var par = converter.bodyNodes(state, util.dom.getChildren(indiv));
    //     nodes.push(par[0].id);
    //   }
    // }

    // Get reviewing editor
    // --------------

    var editor = article.querySelector("contrib[contrib-type=editor]");
    if (editor){
      var aff = editor.querySelector("xref")
      var affid = aff.getAttribute("rid")
      var inst = article.querySelector("aff[id="+affid+"] addr-line").textContent;
      var name = converter.getName(editor.querySelector('name'));
      // var inst = editor.querySelector("addr-line").textContent;
      var role = editor.querySelector("role").textContent;
      // var country = editor.querySelector("country").textContent;

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
        "content": [name, role, inst].join(", ")
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

      var copyright = license.querySelector("copyright-holder");
      if (copyright) {
        var par = converter.paragraphGroup(state, copyright);
        var textid = par[0].children[0];
        doc.nodes[textid].content += ". ";
        nodes.push(par[0].id);
      }
      var lic = license.querySelector("license");
      if (lic) {
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
    }
    
    doc.create(articleInfo);
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

  // Resolve figure urls
  // --------
  // 

  this.enhanceFigure = function(state, node, element) {
    // var graphic = element.querySelector("graphic");
    // var url = graphic.getAttribute("xlink:href");
    
    // url = [
    //   "http://www.ncbi.nlm.nih.gov/pmc/articles/PMC",
    //   pmcID,
    //   /bin/,
    //   url,
    //   ".jpg"
    // ].join('');

    // node.url = url;
  };

};


BMCConfiguration.Prototype.prototype = DefaultConfiguration.prototype;
BMCConfiguration.prototype = new BMCConfiguration.Prototype();
BMCConfiguration.prototype.constructor = BMCConfiguration;

module.exports = BMCConfiguration;

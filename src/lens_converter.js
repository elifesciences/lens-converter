"use strict";

var _ = require("underscore");
var util = require("substance-util");
var errors = util.errors;
var ImporterError = errors.define("ImporterError");

var XmlBrowserAdapter;
if (typeof window !== "undefined") {
  XmlBrowserAdapter = require('./xml_browser_adapter');
}

// Available configurations
// --------

var ElifeConfiguration = require("./configurations/elife");
var LandesConfiguration = require("./configurations/landes");
var DefaultConfiguration = require("./configurations/default");
var PLOSConfiguration = require("./configurations/plos");
var PeerJConfiguration = require("./configurations/peerj");

var NlmToLensConverter = function(options) {
  this.options = _.extend({}, NlmToLensConverter.DefaultOptions, options);
  this.xmlAdapter = this.options.xmlAdapter || new XmlBrowserAdapter();
};

NlmToLensConverter.Prototype = function() {

  this._annotationTypes = {
    "bold": "strong",
    "italic": "emphasis",
    "monospace": "code",
    "sub": "subscript",
    "sup": "superscript",
    "underline": "underline",
    "ext-link": "link",
    "xref": "",
    "email": "link",
    "named-content": "",
    "inline-formula": "inline-formula"
  };

  // mapping from xref.refType to node type
  this._refTypeMapping = {
    "bibr": "citation_reference",
    "fig": "figure_reference",
    "table": "figure_reference",
    "supplementary-material": "figure_reference",
    "other": "figure_reference",
    "list": "definition_reference",
  };

  this.isAnnotation = function(type) {
    return this._annotationTypes[type] !== undefined;
  };

  this.isParagraphish = function(element) {
    var childNodes = this.xmlAdapter.childNodes(element);
    for (var i = 0; i < childNodes.length; i++) {
      var el = childNodes[i];
      var type = this.xmlAdapter.getType(el);
      if (type === "text" && !this.isAnnotation(type)) return false;
    }
    return true;
  };

  // Helpers
  // --------

  this.getName = function(nameEl) {
    if (!nameEl) return "N/A";
    var names = [];

    var surnameEl = this.xmlAdapter.find(nameEl, "surname");
    var givenNamesEl = this.xmlAdapter.find(nameEl, "given-names");
    var suffix = this.xmlAdapter.find(nameEl, "suffix");
    if (givenNamesEl) names.push(this.xmlAdapter.getText(givenNamesEl));
    if (surnameEl) names.push(this.xmlAdapter.getText(surnameEl));
    if (suffix) return [names.join(" "), this.xmlAdapter.getText(suffix)].join(", ");

    return names.join(" ");
  };

  this.toHtml = function(el) {
    if (!el) return "";
    return this.xmlAdapter.toString(el);
  };

  this.mmlToHtmlString = function(el) {
    var html = this.toHtml(el);
    html = html.replace(/<(\/)?mml:([^>]+)>/g, "<$1$2>");
    return html;
  };

  // ### The main entry point for starting an import

  this.import = function(input) {
    var xmlDoc;

    // Note: when we are using jqueries get("<file>.xml") we
    // magically get a parsed XML document already
    if (_.isString(input)) {
      xmlDoc = this.xmlAdapter.parseXML(input);
    } else {
      xmlDoc = input;
    }

    this.sanitizeXML(xmlDoc);

    // Creating the output Document via factore, so that it is possible to
    // create specialized NLMImporter later which would want to instantiate
    // a specialized Document type
    var doc = this.createDocument();

    // For debug purposes
    // window.doc = doc;

    // A deliverable state which makes this importer stateless
    var state = this.createState(xmlDoc, doc);

    // The configuration can be provided as option or created dynamically based on the XML content
    // by overriding this.getConfig(xmlDoc);
    state.config = this.options.config || this.getConfiguration(xmlDoc);

    // Note: all other methods are called corresponding
    return this.document(state, xmlDoc);
  };

  // Sometimes we need to deal with unconsistent XML
  // When overwriting this function in your custom converter
  // you can solve those issues in a preprocessing step instead of adding
  // hacks in the main converter code

  this.sanitizeXML = function(/*xmlDoc*/) {
  };

  // TODO: to avoid needing to adapt the core converter code each time when adding a custom configuration
  // it would be cleaner to do this on application level.
  // To solve this generically, we would need a certain place/service to register configurations.
  this.getConfiguration = function(xmlDoc) {
    var config;
    // ATTENTION: publisher-name is not necessarily unique in the document!
    var publisherName = this.xmlAdapter.getText(this.xmlAdapter.find(xmlDoc, "//publisher-name"));
    if (publisherName === "Landes Bioscience") {
      config = new LandesConfiguration();
    } else if (publisherName === "eLife Sciences Publications, Ltd") {
      config = new ElifeConfiguration();
    } else if (publisherName === "Public Library of Science") {
      config = new PLOSConfiguration();
    } else if (publisherName === 'PeerJ Inc.') {
      config = new PeerJConfiguration();
    } else {
      config = new DefaultConfiguration();
    }
    return config;
  };

  this.createState = function(xmlDoc, doc) {
    return new NlmToLensConverter.State(this, xmlDoc, doc);
  };

  // Overridden to create a Lens Article instance
  this.createDocument = function() {
    var Article = require("lens-article");
    var doc = new Article();
    return doc;
  };

  this.show = function(state, nodes) {
    _.each(nodes, function(n) {
      state.config.showNode(state, n);
    });
  };

  this.extractDate = function(dateEl) {
    if (!dateEl) return null;

    var year = this.xmlAdapter.find(dateEl, "year");
    var month = this.xmlAdapter.find(dateEl, "month");
    var day = this.xmlAdapter.find(dateEl, "day");

    var res = [this.xmlAdapter.getText(year), this.xmlAdapter.getText(month)];
    if (day) res.push(this.xmlAdapter.getText(day));

    return res.join("-");
  };

  this.extractPublicationInfo = function(state, article) {
    var doc = state.doc;

    var articleMeta = this.xmlAdapter.find(article, "front/article-meta");
    var pubDate = this.xmlAdapter.find(articleMeta, "pub-date");
    var history = this.xmlAdapter.findAll(articleMeta, "history/date");

    // Journal title
    //
    var journalTitle = this.xmlAdapter.find(article, ".//journal-title");

    // DOI
    //
    // <article-id pub-id-type="doi">10.7554/eLife.00003</article-id>
    var articleDOI = this.xmlAdapter.find(article, ".//article-id[@pub-id-type='doi']");

    // Related article if exists
    //
    // TODO: can't there be more than one?
    var relatedArticle = this.xmlAdapter.find(article, ".//related-article");

    // Article information
    var articleInfo = this.extractArticleInfo(state, article);

    // Create PublicationInfo node
    // ---------------

    var pubInfoNode = {
      "id": "publication_info",
      "type": "publication_info",
      "published_on": this.extractDate(pubDate),
      "journal": journalTitle ? this.xmlAdapter.getText(journalTitle) : "",
      "related_article": relatedArticle ? this.xmlAdapter.getAttribute(relatedArticle, "xlink:href") : "",
      "doi": articleDOI ? ["http://dx.doi.org/", this.xmlAdapter.getText(articleDOI)].join("") : "",
      "article_info": articleInfo.id,
      // TODO: 'article_type' should not be optional; we need to find a good default implementation
      "article_type": "",
      // Optional fields not covered by the default implementation
      // Implement config.enhancePublication() to complement the data
      // TODO: think about how we could provide good default implementations
      "keywords": [],
      "links": [],
      "subjects": [],
      "supplements": [],
      "history": [],
      // TODO: it seems messy to have this in the model
      // Instead it would be cleaner to add 'custom': 'object' field
      "research_organisms": [],
      // TODO: this is in the schema, but seems to be unused
      "provider": "",
    };

    for (var i = 0; i < history.length; i++) {
      var dateEl = history[i];
      var historyEntry = {
        type: this.xmlAdapter.getAttribute(dateEl, 'date-type'),
        date: this.extractDate(dateEl)
      };
      pubInfoNode.history.push(historyEntry);
    }

    doc.create(pubInfoNode);
    doc.show("info", pubInfoNode.id, 0);

    state.config.enhancePublicationInfo(state, pubInfoNode);
  };

  this.extractArticleInfo = function(state, article) {
    // Initialize the Article Info object
    var articleInfo = {
      "id": "articleinfo",
      "type": "composite",
    };
    var doc = state.doc;

    var nodes = [];
    // Impact statement
    nodes = nodes.concat(this.extractAuthorImpactStatement(state, article));
    // Reviewing editor
    nodes = nodes.concat(this.extractEditor(state, article));
    // Datasets
    nodes = nodes.concat(this.extractDatasets(state, article));
    // Acknowledgments
    nodes = nodes.concat(this.extractAcknowledgements(state, article));
    // License and Copyright
    nodes = nodes.concat(this.extractCopyrightAndLicense(state, article));
    // Notes (Footnotes + Author notes)
    nodes = nodes.concat(this.extractNotes(state, article));

    articleInfo.children = nodes;
    doc.create(articleInfo);

    return articleInfo;
  };

  this.extractAuthorImpactStatement = function(state, article) {
    var doc = state.doc;
    var nodes = [];
    // Get the author's impact statement
    var meta = this.xmlAdapter.findAll(article, ".//meta-value");
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

      var par = this.paragraphGroup(state, impact);
      nodes.push(par[0].id);
    }
    return nodes;
  };

  // Get reviewing editor
  // --------------
  // TODO: it is possible to have multiple editors. This does only show the first one
  //   However, this would be easy: just querySelectorAll and have 'Reviewing Editors' as heading when there are multiple nodes found

  this.extractEditor = function(state, article) {
    var nodes = [];
    var doc = state.doc;

    // TODO: is there always only one?
    var editor = this.xmlAdapter.find(article, ".//contrib[contrib-type=editor]");
    if (editor) {
      var content = [];

      var name = this.getName(this.xmlAdapter.find(editor, "name"));
      if (name) content.push(name);
      var inst = this.xmlAdapter.find(editor, "institution");
      if (inst) content.push(this.xmlAdapter.getText(inst));
      var country = this.xmlAdapter.find(editor, "country");
      if (country) content.push(this.xmlAdapter.getText(country));

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
        "content": content.join(", ")
      };

      doc.create(t1);
      nodes.push(t1.id);
    }
    return nodes;
  };

  //
  // Extracts major datasets
  // -----------------------

  this.extractDatasets = function(state, article) {
    var nodes = [];
    var doc = state.doc;

    var datasets = this.xmlAdapter.findAll(article, ".//sec");
    for (var i = 0;i <datasets.length;i++){
      var data = datasets[i];
      var type = this.xmlAdapter.getAttribute(data,'sec-type');
      if (type === 'datasets') {
        var h1 = {
          "type" : "heading",
          "id" : state.nextId("heading"),
          "level" : 3,
          "content" : "Major Datasets"
        };
        doc.create(h1);
        nodes.push(h1.id);
        var ids = this.datasets(state, this.xmlAdapter.getChildrenElements(data));
        for (var j=0;j < ids.length;j++) {
          if (ids[j]) {
            nodes.push(ids[j]);
          }
        }
      }
    }
    return nodes;
  };

  var _capitalized = function(str, all) {
    if (all) {
      return str.split(' ').map(function(s){
        return _capitalized(s);
      }).join(' ');
    } else {
      return str.charAt(0).toUpperCase() + str.slice(1);
    }
  };

  this.capitalized = function(str, all) {
    return _capitalized(str, all);
  };

  //
  // Extracts Acknowledgements
  // -------------------------

  this.extractAcknowledgements = function(state, article) {
    var nodes = [];
    var doc = state.doc;

    var acks = this.xmlAdapter.findAll(article, ".//ack");
    if (acks && acks.length > 0) {
      _.each(acks, function(ack) {
        var title = this.xmlAdapter.find(ack, "title");
        var header = {
          "type" : "heading",
          "id" : state.nextId("heading"),
          "level" : 3,
          "content" : title ? this.capitalized(this.xmlAdapter.getText(title).toLowerCase(), "all") : "Acknowledgements"
        };
        doc.create(header);
        nodes.push(header.id);

        // There may be multiple paragraphs per ack element
        var pars = this.bodyNodes(state, this.xmlAdapter.getChildrenElements(ack), {
          ignore: ["title"]
        });
        _.each(pars, function(par) {
          nodes.push(par.id);
        });
      }, this);
    }

    return nodes;
  };

  //
  // Extracts footnotes that should be shown in article info
  // ------------------------------------------
  //
  // Needs to be overwritten in configuration

  this.extractNotes = function(/*state, article*/) {
    var nodes = [];
    return nodes;
  };

  //
  // Extracts Copyright and License Information
  // ------------------------------------------

  this.extractCopyrightAndLicense = function(state, article) {
    var nodes = [];
    var doc = state.doc;

    var license = this.xmlAdapter.find(article, ".//permissions");
    if (license) {
      var h1 = {
        "type" : "heading",
        "id" : state.nextId("heading"),
        "level" : 3,
        "content" : "Copyright & License"
      };
      doc.create(h1);
      nodes.push(h1.id);

      // TODO: this is quite messy. We should introduce a dedicated note for article info
      // and do that rendering related things there, e.g., '. ' separator

      var pars;
      var copyright = this.xmlAdapter.find(license, "copyright-statement");
      if (copyright) {
        pars = this.paragraphGroup(state, copyright);
        if (pars && pars.length) {
          nodes = nodes.concat( _.map(pars, function(p) { return p.id; } ) );
          // append '.' only if there is none yet
          if (this.xmlAdapter.getText(copyright).trim().slice(-1) !== '.') {
            // TODO: this needs to be more robust... what if there are no children
            var par = _.last(pars);
            par.content += ". ";
          }
        }
      }
      var lic = this.xmlAdapter.find(license, "license");
      if (lic) {
        this.xmlAdapter.eachChildElement(lic, function(child) {
          var type = this.xmlAdapter.getType(child);
          if (type === 'p' || type === 'license-p') {
            par = this.paragraphGroup(state, child);
            if (par && par.length) {
              nodes = nodes.concat( _.pluck(par, 'id') );
            }
          }
        }, this);
      }
    }

    return nodes;
  };

  this.extractCover = function(state, article) {
    var doc = state.doc;
    var docNode = doc.get("document");
    var cover = {
      id: "cover",
      type: "cover",
      title: docNode.title,
      authors: [], // docNode.authors,
      abstract: docNode.abstract
    };

    // Create authors paragraph that has contributor_reference annotations
    // to activate the author cards

    _.each(docNode.authors, function(contributorId) {
      var contributor = doc.get(contributorId);

      var authorsPara = {
        "id": "text_"+contributorId+"_reference",
        "type": "text",
        "content": contributor.name
      };

      doc.create(authorsPara);
      cover.authors.push(authorsPara.id);

      var anno = {
        id: state.nextId("contributor_reference"),
        type: "contributor_reference",
        path: ["text_" + contributorId + "_reference", "content"],
        range: [0, contributor.name.length],
        target: contributorId
      };

      doc.create(anno);
    }, this);

    // Move to elife configuration
    // -------------------
    // <article-categories>
    // <subj-group subj-group-type="display-channel">...</subj-group>
    // <subj-group subj-group-type="heading">...</subj-group>
    // </article-categories>

    // <article-categories>
    //   <subj-group subj-group-type="display-channel">
    //     <subject>Research article</subject>
    //   </subj-group>
    //   <subj-group subj-group-type="heading">
    //     <subject>Biophysics and structural biology</subject>
    //   </subj-group>
    // </article-categories>

    state.config.enhanceCover(state, cover, article);

    doc.create(cover);
    doc.show("content", cover.id, 0);
  };

  // Note: Substance.Article supports only one author.
  // We use the first author found in the contribGroup for the 'creator' property.
  this.contribGroup = function(state, contribGroup) {
    var i;
    var contribs = this.xmlAdapter.findAll(contribGroup, ".//contrib");
    for (i = 0; i < contribs.length; i++) {
      this.contributor(state, contribs[i]);
    }
    // Extract on-behalf-of element and stick it to the document
    var doc = state.doc;
    var onBehalfOf = this.xmlAdapter.find(contribGroup, "on-behalf-of");
    if (onBehalfOf) doc.on_behalf_of = this.xmlAdapter.getText(onBehalfOf).trim();
  };

  this.affiliation = function(state, aff) {
    var doc = state.doc;

    var institution = this.xmlAdapter.find(aff, "institution");
    var country = this.xmlAdapter.find(aff, "country");
    var label = this.xmlAdapter.find(aff, "label");
    var department = this.xmlAdapter.find(aff, "addr-line//named-content[@content-type='department']");
    var city = this.xmlAdapter.find(aff, "addr-line//named-content[@content-type='city']");

    // TODO: this is a potential place for implementing a catch-bin
    // For that, iterate all children elements and fill into properties as needed or add content to the catch-bin

    var affiliationNode = {
      id: state.nextId("affiliation"),
      type: "affiliation",
      source_id: this.xmlAdapter.getAttribute(aff, "id"),
      label: label ? this.xmlAdapter.getText(label) : null,
      department: department ? this.xmlAdapter.getText(department) : null,
      city: city ? this.xmlAdapter.getText(city) : null,
      institution: institution ? this.xmlAdapter.getText(institution) : null,
      country: country ? this.xmlAdapter.getText(country): null
    };
    doc.create(affiliationNode);
  };

  this.contributor = function(state, contrib) {
    var doc = state.doc;
    var id = state.nextId("contributor");
    var contribNode = {
      id: id,
      source_id: this.xmlAdapter.getAttribute(contrib, "id"),
      type: "contributor",
      name: "",
      affiliations: [],
      fundings: [],
      bio: [],

      // Not yet supported... need examples
      image: "",
      deceased: false,
      emails: [],
      contribution: "",
      members: []
    };

    // Extract role
    var role = this.xmlAdapter.find(contrib, "role");

    if (role) {
      contribNode["role"] = this.xmlAdapter.getText(role);
    }

    // Search for author bio and author image
    var bio = this.xmlAdapter.find(contrib, "bio");
    if (bio) {
      _.each(util.dom.getChildrenElements(bio), function(par) {
        var graphic = this.xmlAdapter.find(par, "graphic");
        if (graphic) {
          var imageUrl = this.xmlAdapter.getAttribute(graphic, "xlink:href");
          contribNode.image = imageUrl;
        } else {
          var pars = this.paragraphGroup(state, par);
          if (pars.length > 0) {
            contribNode.bio = [ pars[0].id ];
          }
        }
      }, this);
    }

    // Deceased?

    if (this.xmlAdapter.getAttribute(contrib, "deceased") === "yes") {
      contribNode.deceased = true;
    }

    // Extract ORCID
    // -----------------
    //
    // <uri content-type="orcid" xlink:href="http://orcid.org/0000-0002-7361-560X"/>

    var orcidURI = this.xmlAdapter.find(contrib, ".//uri[@content-type='orcid']");
    if (orcidURI) {
      contribNode.orcid = this.xmlAdapter.getAttribute(orcidURI, "xlink:href");
    }

    // Extracting equal contributions
    var nameEl = this.xmlAdapter.find(contrib, "name");
    if (nameEl) {
      contribNode.name = this.getName(nameEl);
    } else {
      var collab = this.xmlAdapter.find(contrib, "collab");
      // Assuming this is an author group
      if (collab) {
        contribNode.name = this.xmlAdapter.getText(collab);
      } else {
        contribNode.name = "N/A";
      }
    }

    this.extractContributorProperties(state, contrib, contribNode);


    // HACK: for cases where no explicit xrefs are given per
    // contributor we assin all available affiliations
    if (contribNode.affiliations.length === 0) {
      contribNode.affiliations = state.affiliations;
    }

    // HACK: if author is assigned a conflict, remove the redundant
    // conflict entry "The authors have no competing interests to declare"
    // This is a data-modelling problem on the end of our input XML
    // so we need to be smart about it in the converter
    if (contribNode.competing_interests.length > 1) {
      contribNode.competing_interests = _.filter(contribNode.competing_interests, function(confl) {
        return confl.indexOf("no competing") < 0;
      });
    }

    if (this.xmlAdapter.getAttribute(contrib, "contrib-type") === "author") {
      doc.nodes.document.authors.push(id);
    }

    doc.create(contribNode);
    doc.show("info", contribNode.id);
  };

  this._getEqualContribs = function (state, contrib, contribId) {
    var result = [];
    var refs = this.xmlAdapter.findAll(state.xmlDoc, "//xref[@rid='"+contribId+"']");
    // Find xrefs within contrib elements
    _.each(refs, function(ref) {
      var c = this.xmlAdapter.getParent(ref);
      if (c !== contrib) result.push(this.getName(this.xmlAdapter.find(c, "name")));
    }, this);
    return result;
  };

  this.extractContributorProperties = function(state, contrib, contribNode) {
    var doc = state.doc;

    // Extract equal contributors
    var equalContribs = [];
    var compInterests = [];

    // extract affiliations stored as xrefs
    var xrefs = this.xmlAdapter.findAll(contrib, ".//xref");
    _.each(xrefs, function(xref) {
      var rid = this.xmlAdapter.getAttribute(xref, "rid");
      var refType = this.xmlAdapter.getAttribute(xref, "ref-type");
      if (refType === "aff") {
        var affNode = doc.getNodeBySourceId(rid);
        if (affNode) {
          contribNode.affiliations.push(affNode.id);
          state.used[rid] = true;
        }
      } else if ( refType === "other") {
        // FIXME: it seems *very* custom to interprete every 'other' that way
        // TODO: try to find and document when this is applied
        var referencedEl = this.xmlAdapter.getElementById(state.xmlDoc, rid);
        if (!referencedEl) {
          console.error("Could not find element with id ", rid);
          return;
        }
        var type = this.xmlAdapter.getType(referencedEl);
        if (type === "award-group") {
          var awardGroup = referencedEl;
          var fundingSource = this.xmlAdapter.find(awardGroup, "funding-source");
          var awardId = this.xmlAdapter.find(awardGroup, "award-id");
          if (!fundingSource) {
            console.error("Invalid award group", fundingSource, awardId);
            return;
          }
          awardId = awardId ?  ", "+this.xmlAdapter.getText(awardId) : "";
          // Funding source nodes are looking like this
          //
          // <funding-source>
          //   National Institutes of Health
          //   <named-content content-type="funder-id">http://dx.doi.org/10.13039/100000002</named-content>
          // </funding-source>
          //
          // and we only want to display the first text node, excluding the funder id
          var fundingSourceName = this.xmlAdapter.getText(this.xmlAdapter.getChildNodes(fundingSource)[0]);
          contribNode.fundings.push([fundingSourceName, awardId].join(''));
        } else {
          console.error("Don't know what to do with <xref ref-type=other> element pointing to element of type", type);
        }
      } else if (refType === "corresp") {
        var correspId = rid;
        var corresp = this.xmlAdapter.getElementById(state.xmlDoc, correspId);
        if (!corresp) return;
        // TODO: a corresp element allows *much* more than just an email
        // Thus, we are leaving this like untouched, so that it may be grabbed by extractAuthorNotes()
        // state.used[correspId] = true;
        var email = this.xmlAdapter.find(contrib, "email");
        if (!email) return;
        contribNode.emails.push(this.xmlAdapter.getText(email));
      } else if (refType === "fn") {
        var fnElem = this.xmlAdapter.getElementById(state.xmlDoc, rid);
        var fnId = this.xmlAdapter.getAttribute(fnElem, "id");
        var used = true;
        if (fnElem) {
          var fnType = this.xmlAdapter.getAttribute(fnElem, "fn-type");
          switch (fnType) {
            case "con":
              contribNode.contribution = this.xmlAdapter.getText(fnElem);
              break;
            case "conflict":
              compInterests.push(this.xmlAdapter.getText(fnElem).trim());
              break;
            case "present-address":
              contribNode.present_address = this.xmlAdapter.getText(this.xmlAdapter.find(fnElem, "p"));
              break;
            case "equal":
              equalContribs = this._getEqualContribs(state, contrib, fnId);
              break;
            case "other":
              // HACK: sometimes equal contribs are encoded as 'other' plus special id
              if (fnId.indexOf("equal-contrib")>=0) {
                equalContribs = this._getEqualContribs(state, contrib, fnId);
              } else {
                used = false;
              }
              break;
            default:
              used = false;
          }
          if (used) state.used[rid] = true;
        }
      } else {
        // TODO: this is a potential place for implementing a catch-bin
        // For that, we could push the content of the referenced element into the contrib's catch-bin
        console.log("Skipping contrib's xref",  this.xmlAdapter.getText(xref));
      }
    }, this);

    // Extract member list for person group
    // eLife specific?
    // ----------------

    if (compInterests.length > 1) {
      compInterests = _.filter(compInterests, function(confl) {
        return confl.indexOf("no competing") < 0;
      });
    }

    contribNode.competing_interests = compInterests;
    var memberList =  this.xmlAdapter.find(contrib, ".//xref[@ref-type='other']");

    if (memberList) {
      var memberListId = this.xmlAdapter.getAttribute(memberList, "rid");
      var members = this.xmlAdapter.findAll(state.xmlDoc, "//*[id='"+memberListId+"']/contrib");
      contribNode.members = _.map(members, function(m) {
        return this.getName(this.xmlAdapter.find(m, "name"));
      }, this);
    }

    contribNode.equal_contrib = equalContribs;
    contribNode.competing_interests = compInterests;
  };

  // Parser
  // --------
  // These methods are used to process XML elements in
  // using a recursive-descent approach.


  // ### Top-Level function that takes a full NLM tree
  // Note: a specialized converter can derive this method and
  // add additional pre- or post-processing.

  this.document = function(state, xmlDoc) {
    var doc = state.doc;
    var article = this.xmlAdapter.find(xmlDoc, "article");
    if (!article) {
      throw new ImporterError("Expected to find an 'article' element.");
    }
    // recursive-descent for the main body of the article
    this.article(state, article);
    // post-processing:
    this.postProcessAnnotations(state);
    // Rebuild views to ensure consistency
    _.each(doc.containers, function(container) {
      container.rebuild();
    });
    return doc;
  };

  this.postProcessAnnotations = function(state) {
    // Creating the annotations afterwards, to make sure
    // that all referenced nodes are available
    for (var i = 0; i < state.annotations.length; i++) {
      var anno = state.annotations[i];
      if (anno.target) {
        var targetNode = state.doc.getNodeBySourceId(anno.target);
        if (targetNode) {
          anno.target = targetNode.id;
        } else {
          console.log("Could not lookup targetNode for annotation", anno);
        }
      }
      state.doc.create(state.annotations[i]);
    }
  };

  // Article
  // --------
  // Does the actual conversion.
  //
  // Note: this is implemented as lazy as possible (ALAP) and will be extended as demands arise.
  //
  // If you need such an element supported:
  //  - add a stub to this class (empty body),
  //  - add code to call the method to the appropriate function,
  //  - and implement the handler here if it can be done in general way
  //    or in your specialized importer.

  this.article = function(state, article) {
    var doc = state.doc;

    // Assign id
    var articleId = this.xmlAdapter.find(article, ".//article-id");
    // Note: Substance.Article does only support one id
    if (articleId) {
      doc.id = this.xmlAdapter.getText(articleId);
    } else {
      // if no id was set we create a random one
      doc.id = util.uuid();
    }

    // Extract glossary
    this.extractDefinitions(state, article);

    // Extract authors etc.
    this.extractAffilitations(state, article);
    this.extractContributors(state, article);

    // Same for the citations, also globally
    this.extractCitations(state, article);

    // First extract all figure-ish content, using a global approach
    this.extractFigures(state, article);

    // Make up a cover node
    this.extractCover(state, article);

    // Extract ArticleMeta
    this.extractArticleMeta(state, article);

    // Populate Publication Info node
    this.extractPublicationInfo(state, article);

    var body = this.xmlAdapter.find(article, "body");
    if (body) {
      this.body(state, body);
    }

    // Give the config the chance to add stuff
    state.config.enhanceArticle(this, state, article);

  };

  this.extractDefinitions = function(state /*, article*/) {
    var defItems = this.xmlAdapter.findAll(state.xmlDoc, "//def-item");
    _.each(defItems, function(defItem) {
      var term = this.xmlAdapter.find(defItem, "term");
      var def = this.xmlAdapter.find(defItem, "def");
      var id = this.xmlAdapter.getAttribute(def, 'id') || state.nextId('definition');
      var definitionNode = {
        id: id,
        type: "definition",
        title: this.xmlAdapter.getText(term),
        description: this.xmlAdapter.getText(def)
      };
      state.doc.create(definitionNode);
      state.doc.show("definitions", definitionNode.id);
    });
  };

  // #### Front.ArticleMeta
  //

  this.extractArticleMeta = function(state, article) {
    // var doc = state.doc;

    var articleMeta = this.xmlAdapter.find(article, "front/article-meta");
    if (!articleMeta) {
      throw new ImporterError("Expected element: 'article-meta'");
    }

    // <article-id> Article Identifier, zero or more
    var articleIds = this.xmlAdapter.findAll(articleMeta, "article-id");
    this.articleIds(state, articleIds);

    // <title-group> Title Group, zero or one
    var titleGroup = this.xmlAdapter.find(articleMeta, "title-group");
    if (titleGroup) {
      this.titleGroup(state, titleGroup);
    }

    // <pub-date> Publication Date, zero or more
    var pubDates = this.xmlAdapter.findAll(articleMeta, "pub-date");
    this.pubDates(state, pubDates);

    this.abstracts(state, articleMeta);

    // Not supported yet:
    // <trans-abstract> Translated Abstract, zero or more
    // <kwd-group> Keyword Group, zero or more
    // <conference> Conference Information, zero or more
    // <counts> Counts, zero or one
    // <custom-meta-group> Custom Metadata Group, zero or one
  };

  this.extractAffilitations = function(state, article) {
    var affiliations = this.xmlAdapter.findAll(article, ".//aff");
    for (var i = 0; i < affiliations.length; i++) {
      this.affiliation(state, affiliations[i]);
    }
  };

  this.extractContributors = function(state, article) {
    // TODO: the spec says, that there may be any combination of
    // 'contrib-group', 'aff', 'aff-alternatives', and 'x'
    // However, in the articles seen so far, these were sub-elements of 'contrib-group', which itself was single
    var contribGroup = this.xmlAdapter.find(article, "front/article-meta/contrib-group");
    if (contribGroup) {
      this.contribGroup(state, contribGroup);
    }
  };

  this.extractFigures = function(state, xmlDoc) {
    // Globally query all figure-ish content, <fig>, <supplementary-material>, <table-wrap>, <media video>
    // mimetype="video"
    var body = this.xmlAdapter.find(xmlDoc, "//body");
    var figureElements = this.xmlAdapter.findAll(body, ".//fig|.//table-wrap|.//supplementary-material|.//media[@mimetype='video']");
    var figureNodes = [];
    var node;

    for (var i = 0; i < figureElements.length; i++) {
      var figEl = figureElements[i];
      var type = this.xmlAdapter.getType(figEl);
      if (type === "fig") {
        node = this.figure(state, figEl);
        if (node) figureNodes.push(node);
      }
      else if (type === "table-wrap") {
        node = this.tableWrap(state, figEl);
        if (node) figureNodes.push(node);
        // nodes = nodes.concat(this.section(state, child));
      } else if (type === "media") {
        node = this.video(state, figEl);
        if (node) figureNodes.push(node);
      } else if (type === "supplementary-material") {

        node = this.supplement(state, figEl);
        if (node) figureNodes.push(node);
      }
    }

    // Show the figures
    if (figureNodes.length > 0) {
      this.show(state, figureNodes);
    }
  };

  this.extractCitations = function(state, xmlDoc) {
    var refList = this.xmlAdapter.find(xmlDoc, "//ref-list");
    if (refList) {
      this.refList(state, refList);
    }
  };

  // articleIds: array of <article-id> elements
  this.articleIds = function(state, articleIds) {
    var doc = state.doc;

    // Note: Substance.Article does only support one id
    if (articleIds.length > 0) {
      doc.id = this.xmlAdapter.getText(articleIds[0]);
    } else {
      // if no id was set we create a random one
      doc.id = util.uuid();
    }
  };

  this.titleGroup = function(state, titleGroup) {
    var doc = state.doc;
    var articleTitle = this.xmlAdapter.find(titleGroup, "article-title");
    if (articleTitle) {
      doc.title = this.annotatedText(state, articleTitle, ['document', 'title'], {
        ignore: ['xref']
      });
    }
    // Not yet supported:
    // <subtitle> Document Subtitle, zero or one
  };

  // Note: Substance.Article supports no publications directly.
  // We use the first pub-date for created_at
  this.pubDates = function(state, pubDates) {
    var doc = state.doc;
    if (pubDates.length > 0) {
      var converted = this.pubDate(state, pubDates[0]);
      doc.created_at = converted.date;
    }
  };

  // Note: this does not follow the spec but only takes the parts as it was necessary until now
  // TODO: implement it thoroughly
  this.pubDate = function(state, pubDate) {
    var day = -1;
    var month = -1;
    var year = -1;
    this.xmlAdapter.eachChildElement(pubDate, function(el) {
      var type = this.xmlAdapter.getType(el);
      var value = this.xmlAdapter.getText(el);
      if (type === "day") {
        day = parseInt(value, 10);
      } else if (type === "month") {
        month = parseInt(value, 10);
      } else if (type === "year") {
        year = parseInt(value, 10);
      }
    }, this);
    var date = new Date(year, month, day);
    return {
      date: date
    };
  };

  this.abstracts = function(state, articleMeta) {
    // <abstract> Abstract, zero or more
    var abstracts = this.xmlAdapter.findAll(articleMeta, ".//abstract");
    _.each(abstracts, function(abs) {
      this.abstract(state, abs);
    }, this);
  };

  this.abstract = function(state, abs) {
    var doc = state.doc;
    var nodes = [];
    var title = this.xmlAdapter.find(abs, "title");
    var heading = {
      id: state.nextId("heading"),
      type: "heading",
      level: 1,
      content: title ? this.xmlAdapter.getText(title) : "Abstract"
    };

    doc.create(heading);
    nodes.push(heading);

    // with eLife there are abstracts having an object-id.
    // TODO: we should store that in the model instead of dropping it

    nodes = nodes.concat(this.bodyNodes(state, this.xmlAdapter.getChildrenElements(abs), {
      ignore: ["title", "object-id"]
    }));

    if (nodes.length > 0) {
      this.show(state, nodes);
    }
  };

  // ### Article.Body
  //

  this.body = function(state, body) {
    var doc = state.doc;
    var heading = {
      id: state.nextId("heading"),
      type: "heading",
      level: 1,
      content: "Main Text"
    };
    doc.create(heading);
    var nodes = [heading].concat(this.bodyNodes(state, this.xmlAdapter.getChildrenElements(body)));
    if (nodes.length > 0) {
      this.show(state, nodes);
    }
  };

  this._ignoredBodyNodes = {
    // figures and table-wraps are treated globally
    "fig": true,
    "table-wrap": true
  };

  // Top-level elements as they can be found in the body or
  // in a section
  // Note: this is also used for boxed-text elements
  this._bodyNodes = {};

  this.bodyNodes = function(state, children, options) {
    var nodes = [], node;

    for (var i = 0; i < children.length; i++) {
      var child = children[i];
      var type = this.xmlAdapter.getType(child);

      if (this._bodyNodes[type]) {
        var result = this._bodyNodes[type].call(this, state, child);
        if (_.isArray(result)) {
          nodes = nodes.concat(result);
        } else if (result) {
          nodes.push(result);
        } else {
          // skip
        }
      } else if (this._ignoredBodyNodes[type] || (options && options.ignore && options.ignore.indexOf(type) >= 0) ) {
        // Note: here are some node types ignored which are
        // processed in an extra pass (figures, tables, etc.)
        node = this.ignoredNode(state, child, type);
        if (node) nodes.push(node);
      } else {
        console.error("Node not yet supported as top-level node: " + type);
      }
    }
    return nodes;
  };

  this._bodyNodes["p"] = function(state, child) {
    return this.paragraphGroup(state, child);
  };
  this._bodyNodes["sec"] = function(state, child) {
    return this.section(state, child);
  };
  this._bodyNodes["list"] = function(state, child) {
    return this.list(state, child);
  };
  this._bodyNodes["disp-formula"] = function(state, child) {
    return this.formula(state, child);
  };
  this._bodyNodes["caption"] = function(state, child) {
    return this.caption(state, child);
  };
  this._bodyNodes["boxed-text"] = function(state, child) {
    return this.boxedText(state, child);
  };
  this._bodyNodes["disp-quote"] = function(state, child) {
    return this.boxedText(state, child);
  };
  this._bodyNodes["attrib"] = function(state, child) {
    return this.paragraphGroup(state, child);
  };
  this._bodyNodes["comment"] = function(state, child) {
    return this.comment(state, child);
  };

  // Overwirte in specific converter
  this.ignoredNode = function(/*state, node, type*/) {
  };

  this.comment = function(/*state, comment*/) {
    // TODO: this is not yet represented in the article data model
    return null;
  };

  this.boxedText = function(state, box) {
    var doc = state.doc;
    // Assuming that there are no nested <boxed-text> elements
    var children = this.bodyNodes(state, this.xmlAdapter.getChildrenElements(box));
    var boxId = state.nextId("box");
    var boxNode = {
      "type": "box",
      "id": boxId,
      "source_id": this.xmlAdapter.getAttribute(box, "id"),
      "label": "",
      "children": _.pluck(children, 'id')
    };
    doc.create(boxNode);
    return boxNode;
  };

  // TODO: rewrite that. It is actually worthless, as it is completely lacking of comments, why and when this is used
  // What 'indivdata' should model is completely unclear. Looking at the implementation of 'indivdata' makes this a pile of b***t.
  this.datasets = function(state, datasets) {
    var nodes = [];

    for (var i=0;i<datasets.length;i++) {
      var data = datasets[i];
      var type = this.xmlAdapter.getType(data);
      if (type === 'p') {
        var obj = this.xmlAdapter.find(data, 'related-object');
        if (obj) {
          nodes = nodes.concat(this.indivdata(state,obj));
        }
        else {
          var pars = this.paragraphGroup(state, data);
          if (pars.length > 0) nodes.push(pars[0].id);
        }
      }
    }
    return nodes;
  };

  // TODO: this is really not ok. So many hackz - no comments.
  this.indivdata = function(state,indivdata) {
    var doc = state.doc;

    var p1 = {
      "type" : "composite",
      "id" : state.nextId("indivdata"),
      "children" : []
    };
    var text1 = {
      "type" : "text",
      "id" : state.nextId("text"),
      "content" : ""
    };
    p1.children.push(text1.id);
    var input = this.xmlAdapter.getChildrenElements(indivdata);
    for (var i = 0;i<input.length;i++) {
      var info = input[i];
      var type = this.xmlAdapter.getType(info);
      var par;
      if (type === "name") {
        var children = this.xmlAdapter.getChildrenElements(info);
        for (var j = 0;j<children.length;j++) {
          var name = children[j];
          if (j === 0) {
            par = this.paragraphGroup(state,name);
            p1.children.push(par[0].id);
          }
          else {
            var text2 = {
              "type" : "text",
              "id" : state.nextId("text"),
              "content" : ", "
            };
            doc.create(text2);
            p1.children.push(text2.id);
            par = this.paragraphGroup(state,name);
            p1.children.push(par[0].id);
          }
        }
      }
      else {
        par = this.paragraphGroup(state,info);
        // Smarter null reference check?
        if (par && par[0]) {
          p1.children.push(par[0].id);
        }
      }
    }
    doc.create(p1);
    doc.create(text1);
    return p1.id;
  };

  this.section = function(state, section) {
    // pushing the section level to track the level for nested sections
    state.sectionLevel++;

    var doc = state.doc;
    var children = this.xmlAdapter.getChildrenElements(section);
    var nodes = [];
    // Optional heading label
    var label = this.xmlAdapter.find(section, "label");
    // create a heading
    var title = this.xmlAdapter.find(section, 'title');
    if (!title) {
      console.error("FIXME: every section should have a title", this.toHtml(section));
    }
    // Recursive Descent: get all section body nodes
    nodes = nodes.concat(this.bodyNodes(state, children, {
      ignore: ["title"]
    }));
    if (nodes.length > 0 && title) {
      var id = state.nextId("heading");
      var heading = {
        id: id,
        source_id: this.xmlAdapter.getAttribute(section, "id"),
        type: "heading",
        level: state.sectionLevel,
        content: title ? this.annotatedText(state, title, [id, 'content']) : ""
      };
      if (label) {
        heading.label = this.xmlAdapter.getText(label);
      }
      if (heading.content.length > 0) {
        doc.create(heading);
        nodes.unshift(heading);
      }
    } else if (nodes.length === 0) {
      console.info("NOTE: skipping section without content:", title ? title.innerHTML : "no title");
    }
    // popping the section level
    state.sectionLevel--;
    return nodes;
  };

  this.ignoredParagraphElements = {
    "comment": true,
    "supplementary-material": true,
    "fig": true,
    "fig-group": true,
    "table-wrap": true,
    "media": true
  };

  this.acceptedParagraphElements = {
    "boxed-text": {handler: "boxedText"},
    "list": { handler: "list" },
    "disp-formula": { handler: "formula" },
  };

  this.inlineParagraphElements = {
    // "inline-graphic": true,
    // "inline-formula": true
  };

  // Segments children elements of a NLM <p> element
  // into blocks grouping according to following rules:
  // - "text", "inline-graphic", "inline-formula", and annotations
  // - ignore comments, supplementary-materials
  // - others are treated as singles
  // FIXME: it would be nicer if we could preprocess the XML and go ahead with real elements instead
  // of such array of primitive nodes
  this.segmentParagraphElements = function(paragraph) {
    var blocks = [];
    var lastType = "";
    var iterator = this.xmlAdapter.getChildNodeIterator(paragraph);

    // first fragment the childNodes into blocks
    while (iterator.hasNext()) {
      var child = iterator.next();
      var type = this.xmlAdapter.getType(child);

      // ignore some elements
      if (this.ignoredParagraphElements[type]) continue;

      // paragraph elements
      if (type === "text" || this.isAnnotation(type) || this.inlineParagraphElements[type]) {
        if (lastType !== "paragraph") {
          blocks.push({ handler: "paragraph", nodes: [] });
          lastType = "paragraph";
        }
        _.last(blocks).nodes.push(child);
        continue;
      }
      // other elements are treated as single blocks
      else if (this.acceptedParagraphElements[type]) {
        blocks.push(_.extend({node: child}, this.acceptedParagraphElements[type]));
      }
      lastType = type;
    }
    return blocks;
  };

  // A 'paragraph' is given a '<p>' tag
  // An NLM <p> can contain nested elements that are represented flattened in a Substance.Article
  // Hence, this function returns an array of nodes
  this.paragraphGroup = function(state, paragraph) {
    var nodes = [];

    // Note: there are some elements in the NLM paragraph allowed
    // which are flattened here. To simplify further processing we
    // segment the children of the paragraph elements in blocks
    var blocks = this.segmentParagraphElements(paragraph);

    for (var i = 0; i < blocks.length; i++) {
      var block = blocks[i];
      var node;
      if (block.handler === "paragraph") {
        // FIXME: need to provide a p element or use paragraphGroup
        node = this.paragraph(state, block.nodes);
        if (node) node.source_id = this.xmlAdapter.getAttribute(paragraph, "id");
      } else {
        node = this[block.handler](state, block.node);
      }
      if (node) nodes.push(node);
    }

    return nodes;
  };

  this.paragraph = function(state, paragraphEl) {
    var doc = state.doc;
    // Reset whitespace handling at the beginning of a paragraph.
    // I.e., whitespaces at the beginning will be removed rigorously.
    state.skipWS = true;
    var node = {
      id: state.nextId("paragraph"),
      type: "paragraph",
      content: ""
    };
    // FIXME: it would be nicer if we could preprocess the XML and go ahead with real elements instead
    // of such array of primitive nodes
    if (_.isArray(paragraphEl)) {
      var nodes = paragraphEl;
      state.stack.push({
        path: [node.id, 'content']
      });
      var childIterator = this.xmlAdapter.getChildNodeIterator(nodes);
      node.content = this._annotatedText(state, childIterator, { offset: 0 });
      state.stack.pop();
    } else {
      node.content = this.annotatedText(state, paragraphEl, [node.id, 'label']);
    }
    doc.create(node);
    return node;
  };

  // List type
  // --------

  this.list = function(state, list) {
    var doc = state.doc;

    var listNode = {
      "id": state.nextId("list"),
      "source_id": this.xmlAdapter.getAttribute(list, "id"),
      "type": "list",
      "items": [],
      "ordered": false
    };

    // TODO: better detect ordererd list types (need examples)
    if (this.xmlAdapter.getAttribute(list, "list-type") === "ordered") {
      listNode.ordered = true;
    }

    var listItems = this.xmlAdapter.findAll(list, "list-item");
    for (var i = 0; i < listItems.length; i++) {
      var listItem = listItems[i];
      // Note: we do not care much about what is served as items
      // However, we do not have complex nodes on paragraph level
      // They will be extract as sibling items
      var nodes = this.bodyNodes(state, this.xmlAdapter.getChildrenElements(listItem));
      for (var j = 0; j < nodes.length; j++) {
        listNode.items.push(nodes[j].id);
      }
    }

    doc.create(listNode);
    return listNode;
  };

  // Handle <fig> element
  // --------
  //

  this.figure = function(state, figure) {
    var doc = state.doc;


    // Top level figure node
    var figureNode = {
      "type": "figure",
      "id": state.nextId("figure"),
      "source_id": this.xmlAdapter.getAttribute(figure, "id"),
      "label": "Figure",
      "url": "",
      "caption": null
    };

    var labelEl = this.xmlAdapter.find(figure, "label");
    if (labelEl) {
      figureNode.label = this.annotatedText(state, labelEl, [figureNode.id, 'label']);
    }
    // Add a caption if available
    var caption = this.xmlAdapter.find(figure, "caption");
    if (caption) {
      var captionNode = this.caption(state, caption);
      if (captionNode) figureNode.caption = captionNode.id;
    }

    var attrib = this.xmlAdapter.find(figure, "attrib");
    if (attrib) {
      figureNode.attrib = this.xmlAdapter.getText(attrib);
    }

    // Lets the configuration patch the figure node properties
    state.config.enhanceFigure(state, figureNode, figure);
    doc.create(figureNode);

    return figureNode;
  };

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

    //get supplement info
    var label = this.xmlAdapter.find(supplement, "label");

    var mediaEl = this.xmlAdapter.find(supplement, "media");
    var url = mediaEl ? this.xmlAdapter.getAttribute(mediaEl, "xlink:href") : null;
    var doi = this.xmlAdapter.find(supplement, ".//object-id[@pub-id-type='doi']");
    doi = doi ? "http://dx.doi.org/" + this.xmlAdapter.getText(doi) : "";

    //create supplement node using file ids
    var supplementNode = {
      "id": state.nextId("supplement"),
      "source_id": this.xmlAdapter.getAttribute(supplement, "id"),
      "type": "supplement",
      "label": label ? this.xmlAdapter.getText(label) : "",
      "url": url,
      "caption": null
    };

    // Add a caption if available
    var caption = this.xmlAdapter.find(supplement, "caption");

    if (caption) {
      var captionNode = this.caption(state, caption);
      if (captionNode) supplementNode.caption = captionNode.id;
    }

    // Let config enhance the node
    state.config.enhanceSupplement(state, supplementNode, supplement);
    doc.create(supplementNode);

    return supplementNode;
  };

  // Used by Figure, Table, Video, Supplement types.
  // --------

  this.caption = function(state, caption) {
    var doc = state.doc;

    var captionNode = {
      "id": state.nextId("caption"),
      "source_id": this.xmlAdapter.getAttribute(caption, "id"),
      "type": "caption",
      "title": "",
      "children": []
    };

    var title = this.xmlAdapter.find(caption, "title");
    if (title) {
      captionNode.title = this.annotatedText(state, title, [captionNode.id, 'title']);
    }

    var children = [];
    var paragraphs = this.xmlAdapter.findAll(caption, "p");
    _.each(paragraphs, function(p) {
      var node = this.paragraph(state, p);
      if (node) children.push(node.id);
    }, this);

    captionNode.children = children;
    doc.create(captionNode);

    return captionNode;
  };


  // Example video element
  //
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

    var label = this.xmlAdapter.getText(this.xmlAdapter.find(video, "label"));

    var id = state.nextId("video");
    var videoNode = {
      "id": id,
      "source_id": this.xmlAdapter.getAttribute(video, "id"),
      "type": "video",
      "label": label,
      "title": "",
      "caption": null,
      "poster": ""
    };

    // Add a caption if available
    var caption = this.xmlAdapter.find(video, "caption");
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
    var label = this.xmlAdapter.find(tableWrap, "label");

    var tableNode = {
      "id": state.nextId("html_table"),
      "source_id": this.xmlAdapter.getAttribute(tableWrap, "id"),
      "type": "html_table",
      "title": "",
      "label": label ? this.xmlAdapter.getText(label) : "Table",
      "content": "",
      "caption": null,
      // Not supported yet ... need examples
      footers: [],
      // doi: "" needed?
    };

    // Note: using a DOM div element to create HTML
    var table = this.xmlAdapter.find(tableWrap, "table");
    if (table) {
      tableNode.content = this.toHtml(table);
    }
    this.extractTableCaption(state, tableNode, tableWrap);

    state.config.enhanceTable(state, tableNode, tableWrap);
    doc.create(tableNode);
    return tableNode;
  };

  this.extractTableCaption = function(state, tableNode, tableWrap) {
    // Add a caption if available
    var caption = this.xmlAdapter.find(tableWrap, "caption");
    if (caption) {
      var captionNode = this.caption(state, caption);
      if (captionNode) tableNode.caption = captionNode.id;
    } else {
      console.error('caption node not found for', tableWrap);
    }
  };

  // Formula Node Type
  // --------

  this._getFormulaData = function(formulaElement) {
    var result = [];
    this.xmlAdapter.eachChildElement(formulaElement, function(child) {
      var type = this.xmlAdapter.getType(child);
      switch (type) {
        case "graphic":
        case "inline-graphic":
          result.push({
            format: 'image',
            data: this.xmlAdapter.getAttribute(child, 'xlink:href')
          });
          break;
        case "svg":
          result.push({
            format: "svg",
            data: this.toHtml(child)
          });
          break;
        case "mml:math":
        case "math":
          result.push({
            format: "mathml",
            data: this.mmlToHtmlString(child)
          });
          break;
        case "tex-math":
          result.push({
            format: "latex",
            data: this.xmlAdapter.getText(child)
          });
          break;
        case "label":
          // Skipping - is handled in this.formula()
          break;
        default:
          console.error('Unsupported formula element of type ' + type);
      }
    }, this);
    return result;
  };

  this.formula = function(state, formulaElement, inline) {
    var doc = state.doc;
    var formulaNode = {
      id: state.nextId("formula"),
      source_id: this.xmlAdapter.getAttribute(formulaElement, "id"),
      type: "formula",
      label: "",
      inline: !!inline,
      data: [],
      format: [],
    };
    var label = this.xmlAdapter.find(formulaElement, "label");
    if (label) formulaNode.label = this.xmlAdapter.getText(label);
    var formulaData = this._getFormulaData(formulaElement, inline);
    for (var i = 0; i < formulaData.length; i++) {
      formulaNode.format.push(formulaData[i].format);
      formulaNode.data.push(formulaData[i].data);
    }
    doc.create(formulaNode);
    return formulaNode;
  };

  // Citations
  // ---------

  this.citationTypes = {
    "mixed-citation": true,
    "element-citation": true
  };

  this.refList = function(state, refList) {
    var refs = this.xmlAdapter.findAll(refList, "ref");
    for (var i = 0; i < refs.length; i++) {
      this.ref(state, refs[i]);
    }
  };

  this.ref = function(state, ref) {
    var children = this.xmlAdapter.getChildrenElements(ref);
    for (var i = 0; i < children.length; i++) {
      var child = children[i];
      var type = this.xmlAdapter.getType(child);
      if (this.citationTypes[type]) {
        this.citation(state, ref, child);
      } else if (type === "label") {
        // skip the label here...
        // TODO: could we do something useful with it?
      } else {
        console.error("Not supported in 'ref': ", type);
      }
    }
  };

  // Citation
  // ------------------
  // NLM input example
  //
  // <element-citation publication-type="journal" publication-format="print">
  // <name><surname>Llanos De La Torre Quiralte</surname>
  // <given-names>M</given-names></name>
  // <name><surname>Garijo Ayestaran</surname>
  // <given-names>M</given-names></name>
  // <name><surname>Poch Olive</surname>
  // <given-names>ML</given-names></name>
  // <article-title xml:lang="es">Evolucion de la mortalidad
  // infantil de La Rioja (1980-1998)</article-title>
  // <trans-title xml:lang="en">Evolution of the infant
  // mortality rate in la Rioja in Spain
  // (1980-1998)</trans-title>
  // <source>An Esp Pediatr</source>
  // <year>2001</year>
  // <month>Nov</month>
  // <volume>55</volume>
  // <issue>5</issue>
  // <fpage>413</fpage>
  // <lpage>420</lpage>
  // <comment>Figura 3, Tendencia de mortalidad infantil
  // [Figure 3, Trends in infant mortality]; p. 418.
  // Spanish</comment>
  // </element-citation>

  // TODO: is implemented naively, should be implemented considering the NLM spec
  this.citation = function(state, ref, citation) {
    var doc = state.doc;
    var citationNode;
    var i;

    var id = state.nextId("article_citation");

    // TODO: we should consider to have a more structured citation type
    // and let the view decide how to render it instead of blobbing everything here.
    var personGroup = this.xmlAdapter.find(citation, "person-group");

    // HACK: we try to create a 'articleCitation' when there is structured
    // content (ATM, when personGroup is present)
    // Otherwise we create a mixed-citation taking the plain text content of the element
    if (personGroup) {

      citationNode = {
        "id": id,
        "source_id": this.xmlAdapter.getAttribute(ref, "id"),
        "type": "citation",
        "title": "N/A",
        "label": "",
        "authors": [],
        "doi": "",
        "source": "",
        "volume": "",
        "fpage": "",
        "lpage": "",
        "citation_urls": []
      };

      var nameElements = this.xmlAdapter.findAll(personGroup, "name");
      for (i = 0; i < nameElements.length; i++) {
        citationNode.authors.push(this.getName(nameElements[i]));
      }

      // Consider collab elements (treat them as authors)
      var collabElements = this.xmlAdapter.findAll(personGroup, "collab");
      for (i = 0; i < collabElements.length; i++) {
        citationNode.authors.push(this.xmlAdapter.getText(collabElements[i]));
      }

      var source = this.xmlAdapter.find(citation, "source");
      if (source) citationNode.source = this.xmlAdapter.getText(source);

      var articleTitle = this.xmlAdapter.find(citation, "article-title");
      if (articleTitle) {
        citationNode.title = this.annotatedText(state, articleTitle, [id, 'title']);
      } else {
        var comment = this.xmlAdapter.find(citation, "comment");
        if (comment) {
          citationNode.title = this.annotatedText(state, comment, [id, 'title']);
        } else {
          // 3rd fallback -> use source
          if (source) {
            citationNode.title = this.annotatedText(state, source, [id, 'title']);
          } else {
            console.error("FIXME: this citation has no title", citation);
          }
        }
      }

      var volume = this.xmlAdapter.find(citation, "volume");
      if (volume) citationNode.volume = this.xmlAdapter.getText(volume);

      var publisherLoc = this.xmlAdapter.find(citation, "publisher-loc");
      if (publisherLoc) citationNode.publisher_location = this.xmlAdapter.getText(publisherLoc);

      var publisherName = this.xmlAdapter.find(citation, "publisher-name");
      if (publisherName) citationNode.publisher_name = this.xmlAdapter.getText(publisherName);

      var fpage = this.xmlAdapter.find(citation, "fpage");
      if (fpage) citationNode.fpage = this.xmlAdapter.getText(fpage);

      var lpage = this.xmlAdapter.find(citation, "lpage");
      if (lpage) citationNode.lpage = this.xmlAdapter.getText(lpage);

      var year = this.xmlAdapter.find(citation, "year");
      if (year) citationNode.year = this.xmlAdapter.getText(year);

      // Note: the label is child of 'ref'
      var label = this.xmlAdapter.find(ref, "label");
      if(label) citationNode.label = this.xmlAdapter.getText(label);

      var doi = this.xmlAdapter.find(citation, ".//pub-id[@pub-id-type='doi']|.//ext-link[@ext-link-type='doi']");
      if(doi) citationNode.doi = "http://dx.doi.org/" + this.xmlAdapter.getText(doi);
    } else {
      console.error("FIXME: there is one of those 'mixed-citation' without any structure. Skipping ...", citation);
      return;
    }

    doc.create(citationNode);
    doc.show("citations", id);

    return citationNode;
  };

  // Article.Back
  // --------

  this.back = function(/*state, back*/) {
    // No processing at the moment
    return null;
  };


  // Annotations
  // -----------

  this.createAnnotation = function(state, el, start, end) {
    // do not create an annotaiton if there is no range
    if (start === end) return;
    var type = this.xmlAdapter.getType(el);
    var anno = {
      type: "annotation",
      path: _.last(state.stack).path,
      range: [start, end],
    };
    this.addAnnotationData(state, anno, el, type);
    state.config.enhanceAnnotationData(state, anno, el, type);

    // assign an id after the type has been extracted to be able to create typed ids
    anno.id = state.nextId(anno.type);
    state.annotations.push(anno);
  };

  // Called for annotation types registered in this._annotationTypes
  this.addAnnotationData = function(state, anno, el, type) {
    anno.type = this._annotationTypes[type] || "annotation";
    if (type === 'xref') {
      this.addAnnotationDataForXref(state, anno, el);
    } else if (type === "ext-link") {
      anno.url = this.xmlAdapter.getAttribute(el, "xlink:href");
      // Add 'http://' to URIs without a protocol, such as 'www.google.com'
      // Except: Url starts with a slash, then we consider them relative
      var extLinkType = this.xmlAdapter.getAttribute(el, 'ext-link-type') || '';
      if (extLinkType.toLowerCase() === 'uri' && !/^\w+:\/\//.exec(anno.url) && !/^\//.exec(anno.url)) {
        anno.url = 'http://' + anno.url;
      } else if (extLinkType.toLowerCase() === 'doi') {
        anno.url = ["http://dx.doi.org/", anno.url].join("");
      }
    } else if (type === "email") {
      anno.url = "mailto:" + this.xmlAdapter.getText(el).trim();
    } else if (type === 'inline-graphic') {
      anno.url = this.xmlAdapter.getAttribute(el, "xlink:href");
    } else if (type === 'inline-formula') {
      var formula = this.formula(state, el, "inline");
      anno.target = formula.id;
    }
  };

  this.addAnnotationDataForXref = function(state, anno, el) {
    var refType = this.xmlAdapter.getAttribute(el, "ref-type");
    var sourceId = this.xmlAdapter.getAttribute(el, "rid");
    // Default reference is a cross_reference
    anno.type = this._refTypeMapping[refType] || "cross_reference";
    if (sourceId) anno.target = sourceId.split(" ")[0];
  };

  // Parse annotated text
  // --------------------
  // Make sure you call this method only for nodes where `this.isParagraphish(node) === true`
  //
  this.annotatedText = function(state, node, path, options) {
    options = options || {};
    state.stack.push({
      path: path,
      ignore: options.ignore
    });
    var childIterator = this.xmlAdapter.getChildNodeIterator(node);
    var text = this._annotatedText(state, childIterator, options);
    state.stack.pop();
    return text;
  };

  // Internal function for parsing annotated text
  // --------------------------------------------
  // As annotations are nested this is a bit more involved and meant for
  // internal use only.
  //
  this._annotatedText = function(state, iterator, options) {
    var plainText = "";

    var charPos = (options.offset === undefined) ? 0 : options.offset;
    var nested = !!options.nested;
    var breakOnUnknown = !!options.breakOnUnknown;

    while(iterator.hasNext()) {
      var el = iterator.next();
      var type = this.xmlAdapter.getType(el);
      // Plain text nodes...
      if (type === "text") {
        var text = state.acceptText(this.xmlAdapter.getText(el));
        plainText += text;
        charPos += text.length;
      }
      // Annotations...
      else {
        var annotatedText;
        if (this.isAnnotation(type)) {
          if (state.top().ignore.indexOf(type) < 0) {
            var start = charPos;
            if (this._annotationTextHandler[type]) {
              annotatedText = this._annotationTextHandler[type].call(this, state, el, type, charPos);
            } else {
              annotatedText = this._getAnnotationText(state, el, type, charPos);
            }
            plainText += annotatedText;
            charPos += annotatedText.length;
            if (!state.ignoreAnnotations) {
              this.createAnnotation(state, el, start, charPos);
            }
          }
        }
        // Unsupported...
        else if (!breakOnUnknown) {
          if (state.top().ignore.indexOf(type) < 0) {
            annotatedText = this._getAnnotationText(state, el, type, charPos);
            plainText += annotatedText;
            charPos += annotatedText.length;
          }
        } else {
          if (nested) {
            console.error("Node not yet supported in annoted text: " + type);
          }
          else {
            // on paragraph level other elements can break a text block
            // we shift back the position and finish this call
            iterator.back();
            break;
          }
        }
      }
    }
    return plainText;
  };

  // A place to register handlers to override how the text of an annotation is created.
  // The default implementation is this._getAnnotationText() which extracts the plain text and creates
  // nested annotations if necessary.
  // Examples for other implementations:
  //   - links: the label of a link may be shortened in certain cases
  //   - inline elements: we model inline elements by a pair of annotation and a content node, and we create a custom label.

  this._annotationTextHandler = {};

  this._getAnnotationText = function(state, el, type, charPos) {
    // recurse into the annotation element to collect nested annotations
    // and the contained plain text
    var childIterator = this.xmlAdapter.getChildNodeIterator(el);
    var annotatedText = this._annotatedText(state, childIterator, { offset: charPos, nested: true });
    return annotatedText;
  };

  this._annotationTextHandler['ext-link'] = function(state, el, type, charPos) {
    var annotatedText = this._getAnnotationText(state, el, charPos);
    // Shorten label for URL links (i.e. if label === url )
    if (type === 'ext-link' && this.xmlAdapter.getAttribute(el, 'xlink:href') === annotatedText.trim()) {
      annotatedText = this.shortenLinkLabel(state, annotatedText);
    }
    return annotatedText;
  };

  this._annotationTextHandler['inline-formula'] = function(state) {
    return state.acceptText("{{inline-formula}}");
  };

  this.shortenLinkLabel = function(state, linkLabel) {
    var LINK_MAX_LENGTH = 50;
    var MARGIN = 10;
    // The strategy is preferably to shorten the fragment after the host part, preferring the tail.
    // If this is not possible, both parts are shortened.
    if (linkLabel.length > LINK_MAX_LENGTH) {
      var match = /((?:\w+:\/\/)?[\/]?[^\/]+[\/]?)(.*)/.exec(linkLabel);
      if (!match) {
        linkLabel = linkLabel.substring(0, LINK_MAX_LENGTH - MARGIN) + '...' + linkLabel.substring(linkLabel.length - MARGIN - 3);
      } else {
        var host = match[1] || '';
        var tail = match[2] || '';
        if (host.length > LINK_MAX_LENGTH - MARGIN) {
          linkLabel = host.substring(0, LINK_MAX_LENGTH - MARGIN) + '...' + tail.substring(tail.length - MARGIN - 3);
        } else {
          var margin = Math.max(LINK_MAX_LENGTH - host.length - 3, MARGIN - 3);
          linkLabel = host + '...' + tail.substring(tail.length - margin);
        }
      }
    }
    return linkLabel;
  };


};

NlmToLensConverter.State = function(converter, xmlDoc, doc) {
  var self = this;

  // the input xml document
  this.xmlDoc = xmlDoc;
  this.xmlAdapter = converter.xmlAdapter;

  // the output substance document
  this.doc = doc;

  // keep track of the options
  this.options = converter.options;

  this.config = new DefaultConfiguration();

  // store annotations to be created here
  // they will be added to the document when everything else is in place
  this.annotations = [];

  // when recursing into sub-nodes it is necessary to keep the stack
  // of processed nodes to be able to associate other things (e.g., annotations) correctly.
  this.stack = [];

  this.sectionLevel = 1;

  // Tracks all available affiliations
  this.affiliations = [];

  // an id generator for different types
  var ids = {};
  if (this.options.shortIds) ids = 0;
  this.nextId = function(type) {
    if (this.options.shortIds) {
      return ""+ids++;
    }
    ids[type] = ids[type] || 0;
    ids[type]++;
    return type +"_"+ids[type];
  };

  // store ids here which have been processed already
  this.used = {};

  // Note: it happens that some XML files are edited without considering the meaning of whitespaces
  // to increase readability.
  // This *hack* eliminates multiple whitespaces at the begin and end of textish elements.
  // Tabs and New Lines are eliminated completely. So with this, the preferred way to prettify your XML
  // is to use Tabuators and New Lines. At the same time, it is not possible anymore to have soft breaks within
  // a text.

  var WS_LEFT = /^\s+/g;
  var WS_LEFT_ALL = /^\s*/g;
  var WS_RIGHT = /\s+$/g;
   var WS_ALL = /\s+/g;
  // var ALL_WS_NOTSPACE_LEFT = /^[\t\n]+/g;
  // var ALL_WS_NOTSPACE_RIGHT = /[\t\n]+$/g;
  var SPACE = " ";
  var TABS_OR_NL = /[\t\n\r]+/g;

  this.lastChar = "";
  this.skipWS = false;

  this.acceptText = function(text) {
    if (!this.options.TRIM_WHITESPACES) {
      return text;
    }

    // EXPERIMENTAL: drop all 'formatting' white-spaces (e.g., tabs and new lines)
    // (instead of doing so only at the left and right end)
    //text = text.replace(ALL_WS_NOTSPACE_LEFT, "");
    //text = text.replace(ALL_WS_NOTSPACE_RIGHT, "");
    text = text.replace(TABS_OR_NL, "");

    if (this.lastChar === SPACE || this.skipWS) {
      text = text.replace(WS_LEFT_ALL, "");
    } else {
      text = text.replace(WS_LEFT, SPACE);
    }
    // this state is only kept for one call
    this.skipWS = false;

    text = text.replace(WS_RIGHT, SPACE);

    // EXPERIMENTAL: also remove white-space within
    if (this.options.REMOVE_INNER_WS) {
      text = text.replace(WS_ALL, SPACE);
    }

    this.lastChar = text[text.length-1] || this.lastChar;
    return text;
  };

  this.top = function() {
    var top = _.last(self.stack);
    top = top || {};
    top.ignore = top.ignore || [];
    return top;
  };
};

NlmToLensConverter.prototype = new NlmToLensConverter.Prototype();
NlmToLensConverter.prototype.constructor = NlmToLensConverter;

NlmToLensConverter.DefaultConfiguration = DefaultConfiguration;

NlmToLensConverter.DefaultOptions = {
  TRIM_WHITESPACES: true,
  REMOVE_INNER_WS: true
};

module.exports = NlmToLensConverter;

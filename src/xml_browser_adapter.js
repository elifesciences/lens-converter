"use strict";

var XmlAdapter = require("./xml_adapter");

require("../lib/wgxpath.install");
window.wgxpath.install();

var XmlBrowserAdapter = function() {
  XmlAdapter.call(this);
};

var NSResolver = {
  lookupNamespaceURI: function() {
    return "void";
  }
};

XmlBrowserAdapter.Prototype = function() {

  this.parseString = function(xmlString) {
    var parser = new DOMParser();
    var xmlDoc = parser.parseFromString(xmlString,"text/xml");
    return xmlDoc;
  };

  this.findAll = function(el, xpath) {
    // TODO: the last arg is a ns resolver
    var elements = window.document.evaluate(xpath, el, NSResolver, XPathResult.ORDERED_NODE_ITERATOR_TYPE);
    if (!elements) return [];
    var result = [];
    var next = elements.iterateNext();
    while(next) {
      result.push(next);
      next = elements.iterateNext();
    }
    return result;
  };

  this.find = function(el, xpath) {
    var xpathResult;
    // try {
      xpathResult = window.document.evaluate(xpath, el, NSResolver, XPathResult.FIRST_ORDERED_NODE_TYPE);
      return xpathResult.singleNodeValue;
    // } catch (err) {
    //   debugger;
    // }
  };

  this.getElementById = function(el, id) {
    if (el.getElementById) {
      return el.getElementById(id);
    } else {
      return XmlAdapter.prototype.getElementById.call(this, el, id);
    }
  };

  this.getAttribute = function(el, name) {
    return el.getAttribute(name);
  };

  this.getType = function(el) {
    if (el.nodeType === window.Node.TEXT_NODE) {
      return "text";
    } else if (el.nodeType === window.Node.COMMENT_NODE) {
      return "comment";
    } else if (el.tagName) {
      return el.tagName.toLowerCase();
    } else {
      console.error("Can't get node type for ", el);
      return "unknown";
    }
  };

  this.toString = function(el) {
    return el.outerHTML;
  };

  this.getInnerHtml = function(el) {
    return el.innerHTML;
  };

  this.getText = function(el) {
    return el.textContent;
  };

  this.getChildNodes = function(el) {
    return el.childNodes;
  };

  this.getParent = function(el) {
    return el.parentNode;
  };

  this.getChildrenElements = function(el) {
    if (el.children !== undefined) return el.children;
    return XmlAdapter.prototype.getChildrenElements.call(this, el);
  };

  this.getFirstElementChild = function(el) {
    return el.firstElementChild;
  };

  this.getNextElementSibling = function(el) {
    return el.nextElementSibling;
  };

};
XmlBrowserAdapter.Prototype.prototype = XmlAdapter.prototype;
XmlBrowserAdapter.prototype = new XmlBrowserAdapter.Prototype();

module.exports = XmlBrowserAdapter;

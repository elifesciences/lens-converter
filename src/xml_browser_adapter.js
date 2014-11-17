"use strict";

var XmlAdapter = require("./xml_adapter");

require("../lib/wgxpath.install");
window.wgxpath.install();

var XmlBrowserAdapter = function() {
  XmlAdapter.call(this);
};

var NSResolver = {
  lookupNamespaceURI: function(prefix) {
    return "void";
  }
};

XmlBrowserAdapter.Prototype = function() {

  this.findAll = function(el, xpath) {
    // TODO: the last arg is a ns resolver
    var elements = window.document.evaluate(xpath, el, NSResolver);
    if (!elements) return [];
  };

  this.find = function(el, xpath) {
    var elements = window.document.evaluate(xpath, el, NSResolver);
    if (!elements || elements.length === 0) return null;
    else return elements[0];
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

  this.getTextContent = function(el) {
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

module.export = XmlBrowserAdapter;

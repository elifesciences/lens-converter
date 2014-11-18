"use strict";

var _ = require("underscore");

var XmlAdapter = function() {
};

XmlAdapter.Prototype = function() {

  this.parserXML = function(string) {
    throw new Error("This method is abstract");
  };

  this.findAll = function(el, xpath) {
    throw new Error("This method is abstract");
  };

  this.find = function(el, xpath) {
    throw new Error("This method is abstract");
  };

  this.getElementById = function(el, id) {
    throw new Error("This method is abstract");
  };

  this.getAttribute = function(el, name) {
    throw new Error("This method is abstract");
  };

  // Get the elements type
  // Either: 'text', 'comment', or tag name
  this.getType = function(el) {
    throw new Error("This method is abstract");
  };

  this.toString = function(el) {
    throw new Error("This method is abstract");
  };

  this.getText = function(el) {
    throw new Error("This method is abstract");
  };

  this.getChildNodes = function(el) {
    throw new Error("This method is abstract");
  };

  this.getParent = function(el) {
    throw new Error("This method is abstract");
  };

  this.eachChildElement = function(el, func, context) {
    var element = this.getFirstElementChild(el);
    while (element) {
      func.call(context, element);
      element = this.getNextElementSibling(element);
    }
  };

  this.getChildrenElements = function(el) {
    var children = [];
    var element = this.getFirstElementChild(el);
    while (element) {
      children.push(element);
      element = this.getNextElementSibling(element);
    }
    return children;
  };

  this.getFirstElementChild = function(el) {
    throw new Error("This method is abstract");
  };

  this.getNextElementSibling = function(el) {
    throw new Error("This method is abstract");
  };

  this.getChildNodeIterator = function(el) {
    return new XmlAdapter.ChildNodeIterator(this, el);
  };

};
XmlAdapter.prototype = new XmlAdapter.Prototype();

XmlAdapter.ChildNodeIterator = function(xmlAdapter, arg) {
  if(_.isArray(arg)) {
    this.nodes = arg;
  } else {
    this.nodes = xmlAdapter.getChildNodes(arg);
  }
  this.length = this.nodes.length;
  this.pos = -1;
};

XmlAdapter.ChildNodeIterator.prototype = {
  hasNext: function() {
    return this.pos < this.length - 1;
  },
  next: function() {
    this.pos += 1;
    return this.nodes[this.pos];
  },
  back: function() {
    if (this.pos >= 0) {
      this.pos -= 1;
    }
    return this;
  }
};

module.exports = XmlAdapter;

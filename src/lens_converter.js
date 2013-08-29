"use strict";

var Converter = null;
var Converter = require("substance-converter");
var NLMImporter = Converter.NLMImporter;

var LensImporter = function() {
};

LensImporter.Prototype = function() {

  // Overridden to create a Lens Article instance
  this.createDocument = function() {
    var Article = require("lens-article");
    var doc = new Article();
    return doc;
  };

};

LensImporter.Prototype.prototype = NLMImporter.prototype;
LensImporter.prototype = new LensImporter.Prototype();

module.exports = {
  Importer: LensImporter
};

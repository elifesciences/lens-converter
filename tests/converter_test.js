"use strict";

// Import
// ========

var Test = require('substance-test');
var assert = Test.assert;
var registerTest = Test.registerTest;
var LensImporter = require('../src/lens_converter').Importer;
var fs = require("substance-util/src/fs");
var Data = require("substance-data");


// Test
// ========

var NLMImporterTest = function () {

  this.setup = function() {
    this.importer = new LensImporter();
  };

  this.importFixture = function(path, cb) {
    fs.readFile(__dirname, path, {encoding: "utf8"}, function(err, data) {
      if (err) return cb(err);
      try {
        this.doc = this.importer.import(data);
        this.annotations = new Data.Graph.Index(this.doc, {
          types: ["annotation"],
          property: "path"
        });
        cb(null);
      } catch (err) {
        cb(err);
      }
    }, this);
  };

  this.actions = [
    // Note: every test is split up into two steps Import and Check
    // to keep the assertion checks outside the asynchronous call to load the data

    "Import: Article 'lorem_ipsum.xml'", function(cb) {
      this.importFixture("../data/lorem_ipsum.xml", cb);
    },

    // "Check: Document's Meta-Data", function() {
    //   assert.isEqual("2013CC4897R", this.doc.id);
    //   assert.isEqual('In vivo functional studies of tumor-specific retrogene NanogP8 in transgenic animals', this.doc.title);
    // },

    "Check: Should have some figures", function() {
      var figuresView = this.doc.get('figures');
      assert.isTrue(figuresView.getNodes().length > 0);
    },

    "Check: Check figure structure", function() {
      var figure = this.doc.get('fig1');

      // Is of type figure

      // Has a caption of multiple paragraphs

      // 
      // var figuresView = this.doc.get('figures');
      // assert.isTrue(figuresView.getNodes().length > 0);
    },

    // "Check: Every figure must have a label", function() {
    //   var figuresView = this.doc.get('figures');
    //   assert.isTrue(figuresView.getNodes().length > 0);
    //   assert.isEqual('Modelling dynamics in protein crystal structures by ensemble refinement', this.doc.title);

    //   _.each(figuresView.getNodes(), function(node) {
    //     assert.isTrue(node.label.length > 0)
    //   });
    // },

    // "Check: Should have some citations", function() {
    //   var citationsView = this.doc.get('citations');
    //   assert.isTrue(citationsView.getNodes().length > 0);
    // }
  ];
};

registerTest(['Lens.Converter', 'Fundamentals'], new NLMImporterTest());

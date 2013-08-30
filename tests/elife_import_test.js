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

    "Import: Article '00311.xml'", function(cb) {
      this.importFixture("./data/00311.xml", cb);
    },

    "Check: Document's Meta Data", function() {
      assert.isEqual("00311", this.doc.id);
      assert.isEqual('Modelling dynamics in protein crystal structures by ensemble refinement', this.doc.title);
    },

    "Check: Should have some figures", function() {
      var figuresView = this.doc.get('figures');
      assert.isTrue(figuresView.getNodes().length > 0);
    },

    "Check: Every figure must have a label", function() {
      var figuresView = this.doc.get('figures');
      assert.isTrue(figuresView.getNodes().length > 0);
      assert.isEqual('Modelling dynamics in protein crystal structures by ensemble refinement', this.doc.title);

      _.each(figuresView.getNodes(), function(node) {
        assert.isTrue(node.label.length > 0)
      });
    },

    "Check: Should have some citations", function() {
      var citationsView = this.doc.get('citations');
      assert.isTrue(citationsView.getNodes().length > 0);
    }
  ];
};

registerTest(['Lens.Converter', 'eLife Import'], new NLMImporterTest());

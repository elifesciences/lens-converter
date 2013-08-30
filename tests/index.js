"use strict";

// LensImporter
// ---------------
// Until we do not have a means to parse the XML on node.js
// the NLM importer is only available in the browser

if (global.window) {
  require("./elife_import_test");
}

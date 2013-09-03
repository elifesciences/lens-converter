var PLOSConfiguration = function() {

};

PLOSConfiguration.Prototype = function() {

  // Resolve figure urls
  // --------
  // 
  this.resolveFigureURLs = function(state, figure) {

    var graphic = figure.querySelector("graphic");
    var url = graphic.getAttribute("xlink:href");

    // Example url to SVG: http://cdn.elifesciences.org/elife-articles/00768/svg/elife00768f001.svg
    // Where are the images with that layout?
  
    console.log('URL', url);    
    // url = [
    //   "http://cdn.elifesciences.org/elife-articles/",
    //   state.doc.id,
    //   "/svg/",
    //   url,
    //   ".svg"
    // ].join('');

    // http://www.plosone.org/article/fetchObject.action?uri=info:doi/10.1371/journal.pone.0072727.g002&representation=PNG_I

    // info:doi/10.1371/journal.pone.0072727.g001
    // http://www.plosone.org/article/fetchObject.action?uri=info:doi/10.1371/journal.pone.0072727.g002&representation=PNG_I

    return {
      url: "http://t3.gstatic.com/images?q=tbn:ANd9GcSZzxvW5ZqgzZD-vBAmn5dDQvLLwS0dcSKh9_yrGaVo2DxqJ8NELg",
      large_url: "http://t3.gstatic.com/images?q=tbn:ANd9GcSZzxvW5ZqgzZD-vBAmn5dDQvLLwS0dcSKh9_yrGaVo2DxqJ8NELg"
    };
  };
};

PLOSConfiguration.prototype = new PLOSConfiguration.Prototype();

module.exports = PLOSConfiguration;

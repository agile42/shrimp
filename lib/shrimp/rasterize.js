var page = require('webpage').create(),
  fs = require('fs'),
  system = require('system'),
  margin = {
    left: system.args[5] || '0cm',
    top: system.args[6] || '0cm',
    right: system.args[7] || '0cm',
    bottom: system.args[8] || '0cm'
  },
  orientation = system.args[9] || 'portrait',
  cookie_file = system.args[10],
  render_time = system.args[11] || 10000,
  time_out = system.args[12] || 90000,
  cookies = {},
  address, output, size, statusCode;

window.setTimeout(function() {
  console.log("Shit's being weird no result within: " + time_out + "ms");
  phantom.exit(1);
}, time_out);

try {
  f = fs.open(cookie_file, "r");
  cookies = JSON.parse(f.read());
  fs.remove(cookie_file)
} catch (e) {
  console.log(e);
}
phantom.cookiesEnabled = true;
phantom.cookies = cookies;

if (system.args.length < 3 || system.args.length > 13) {
  console.log(
    'Usage: rasterize.js URL filename [paperwidth*paperheight|paperformat] [zoom] [margin-left] [margin-top] [margin-right] [margin-bottom] [orientation] [cookie_file] [render_time] [time_out]'
  );
  console.log(
    '  paper (pdf output) examples: "5in*7.5in", "10cm*20cm", "A4", "Letter"'
  );
  phantom.exit(1);
} else {
  address = system.args[1];
  output = system.args[2];
  page.viewportSize = {
    width: 600,
    height: 600
  };
  if (system.args.length > 3 && system.args[2].substr(-4) === ".pdf") {
    size = system.args[3].split('*');
    page.paperSize = size.length === 2 ? {
      width: size[0],
      height: size[1],
      margin: '0px'
    } : {
      format: system.args[3],
      orientation: orientation,
      margin: margin,
      header: {
        height: "0cm",
        contents: phantom.callback(function(pageNum, numPages) {
          return "";
        })
      },
      footer: {
        height: "0cm",
        contents: phantom.callback(function(pageNum, numPages) {
          return "";
        })
      }
    };
  }
  if (system.args.length > 4) {
    page.zoomFactor = system.args[4];
  }

  // determine the statusCode
  page.onResourceReceived = function(resource) {
    if (resource.url == address) {
      statusCode = resource.status;
    }
  };

  page.open(address, function(status) {
    if (status !== 'success' || (statusCode != 200 && statusCode != null)) {
      console.log(statusCode, 'Unable to load the address!');
      if (fs.exists(output)) {
        fs.remove(output);
      }
      try {
        fs.touch(output);
      } catch (e) {
        phantom.exit(1);
        throw e
      }
      phantom.exit(1);
    } else {
      if (page.evaluate(function() {
          return typeof PhantomJSPrinting == "object";
        })) {
        paperSize = page.paperSize;
        paperSize.header.height = page.evaluate(function() {
          return PhantomJSPrinting.header.height;
        });
        paperSize.header.contents = phantom.callback(function(pageNum,
          numPages) {
          return page.evaluate(function(pageNum, numPages) {
            return PhantomJSPrinting.header.contents(pageNum,
              numPages);
          }, pageNum, numPages);
        });
        paperSize.footer.height = page.evaluate(function() {
          return PhantomJSPrinting.footer.height;
        });
        paperSize.footer.contents = phantom.callback(function(pageNum,
          numPages) {
          return page.evaluate(function(pageNum, numPages) {
            return PhantomJSPrinting.footer.contents(pageNum,
              numPages);
          }, pageNum, numPages);
        });
        page.paperSize = paperSize;
        console.log(page.paperSize.header.height);
        console.log(page.paperSize.footer.height);
      }
      window.setTimeout(function() {
        page.render(output + '_tmp.pdf');

        if (fs.exists(output)) {
          fs.remove(output);
        }

        try {
          fs.move(output + '_tmp.pdf', output);
        } catch (e) {
          phantom.exit(1);
          throw e
        }
        console.log('rendered to: ' + output, new Date().getTime());
        phantom.exit();
      }, render_time);
    }
  });
}

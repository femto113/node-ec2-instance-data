// start a fake metadata service, can be used for testing outside of ec2
//
// In order for this to work you need to assign 169.254.169.254 to the current machine
// On a Mac this can be done via System Preferences > Network, click + to create a new service,
// choose an Ethernet interface, enter a service name (e.g. Fake Metadata Service),
// click Create, and enter
//   Configure IPv4: Manually 
//   IP Address: 169.254.169.254
//   Subnet Mask: 0.0.0.0
//   Router: 169.254.169.254
// and Apply

var http = require("http"), fs = require("fs");

var metadata = JSON.parse(fs.readFileSync("./fake-metadata.json"));

function deep_get(root, path) {
    var twig = root, result = undefined;
    path.split('/').forEach(function (branch, index, branches) {
        if (branch) {
            if (index < branches.length - 1) {
                twig = twig[branch];
            } else {
                result = twig && twig[branch];
            }
        }
    });
    return result;
}

var server = http.createServer(function (request, response) {
  console.log(request.url);
  var code = 200, body = '';
  var slash = /\/$/.test(request.url);
  var item = deep_get(metadata, request.url.replace(/\/$/, ''));
  if (typeof(item) === "undefined") {
    code = 404;
    body = '404 not found';
  } else if (item === null) {
    body = "";
  } else if (typeof(item) === "object") {
    if (slash) {
      // if request has a trailing slash return the keys of the children, plus a trailing slash for child objects 
      body = Object.keys(item).map(function (key) { return key + (typeof(item[key]) === "object" ? "/" : "") }).join('\n');
    } else {
      // if request has no trailing slash, no soup for you
      body = ''
    }
  } else {
    body = item.toString();
  }
  response.writeHead(code, { 'Content-Length': body.length, 'Content-Type': 'text/plain' });
  response.end(body);
});

server.on("error", function (error) {
  if (error.code === "EACCES") {
    console.log("need to run this via sudo to bind to port 80");
  } else {
    console.error(JSON.stringify(error));
  }
  process.exit();
});

server.on("listening", function () { console.log("listening for metadata requests at http://169.254.169.254/"); });

server.listen(80, '169.254.169.254');

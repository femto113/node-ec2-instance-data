// recursively retrieve ec2 instance data from the magic URLs AWS provides
// see the AWS EC2 documentation for explanation of why this works
// http://docs.aws.amazon.com/AWSEC2/latest/UserGuide/AESDG-chapter-instancedata.html

var http = require('http');
var EventEmitter = require('events').EventEmitter;

var HOST = '169.254.169.254';

module.exports = new EventEmitter();

// set to true to convert path-name to pathName (allows for . navigation of nested data)
module.exports.camelize = false;
// set with wherever you want to start.  Note that you cannot start successfully at /latest/ or
// above because AWS doesn't return proper path names at the top level (they're missing the trailing /) 
module.exports.roots = ['/latest/meta-data/', '/latest/dynamic/'];

var paths = null, cache = null;

var requests = 0; // number of in-flight requests

module.exports.on('next', function () {
    var path = paths.shift();
    var request = http.get({ host: HOST, path: path }, function (response) {
    requests++;
        if (response.statusCode != 200) { // sometimes it pukes...
            cache[path] = "http error " + response.statusCode;
        } else if (/\/$/.test(path)) { // this is a directory, expect a newline delimited list of children
            response.once('data', function (chunk) {
                if (chunk instanceof Buffer) chunk = chunk.toString('utf8');
                children = chunk.split('\n');
                children.forEach(function (child) { if (child) paths.push(path + child) });
            });
        } else { // this is an end node, expect a string
            response.once('data', function (chunk) {
                if (chunk instanceof Buffer) chunk = chunk.toString('utf8');
                cache[path] = chunk;
            });
        }
        response.once('end', function () { requests--; module.exports.emit('end'); });
    }).on("error", function (error) {
        console.log("error retrieving %s: %s", path, JSON.stringify(error));
    });
});

module.exports.on('end', function () {
    if (paths.length > 0) {
         module.exports.emit('next');
    } else if (requests == 0) {
     module.exports.emit('finalize');
}
 });

// helper to turn a set of paths into nested objects
function deep_set(root, path, value) {
    var twig = root;
    path.split('/').forEach(function (branch, index, branches) {
        if (branch) {
            if (module.exports.camelize) {
         branch = branch.replace(/(\-([a-z]))/g, function (m) { return m[1].toUpperCase(); })
        }
        if (index < branches.length - 1) {
         twig = twig[branch] || (twig[branch] = {});
        } else {
                // optimistically try treating the value as JSON
                try {
           twig[branch] = JSON.parse(value);
        } catch (e) {
            twig[branch] = value;
        }
        }
    }
    });
}

module.exports.on('finalize', function () {
    for (path in cache) deep_set(module.exports, path, cache[path]);
    module.exports.emit('ready');
});

module.exports.init = function (ready_callback) {
    if (ready_callback) module.exports.once('ready', ready_callback);
    module.exports.init = function () {}; // should only ever need to be called once
    cache = {};
    paths = module.exports.roots;
    for (i = 0; i < paths.length; i++) module.exports.emit('next');
};

// recursively retrieve ec2 instance data from the magic URLs AWS provides
// see the AWS EC2 documentation for explanation of why this works
// http://docs.aws.amazon.com/AWSEC2/latest/UserGuide/AESDG-chapter-instancedata.html

var http = require('http');
var EventEmitter = require('events').EventEmitter;

var self = exports = module.exports = new EventEmitter();

// probably don't want to override this, unless you're doing something cute outside of ec2
self.host = '169.254.169.254';
// these should generally not take longer than a few ms apiece, so the default timeout is pretty aggressive
self.timeout = 100;
// set to true to convert path-name to pathName (allows for . navigation of nested data)
self.camelize = false;
// set to true to convert date strings to Date objects
self.parseDates = false;
// set with wherever you want to start.  Note that you cannot start successfully at /latest/ or
// above because AWS doesn't return proper path names at the top level (they're missing the trailing /) 
self.roots = ['/latest/meta-data/', '/latest/dynamic/'];

var paths = null, cache = null;

var requests = 0; // number of in-flight requests

// certain paths require special handling
var special = {
  '/latest/meta-data/public-keys/' : function (chunk) {
      if (chunk instanceof Buffer) chunk = chunk.toString('utf8');
      children = chunk.split('\n');
      children.forEach(function (child) {
        if (child) {
          var a = child.split('='); // index=keyname, e.g. 0=admin@example.com
          paths.push(path + a[0] + '/')
          cache[path + a[0] + '/' + 'name'] = a[1];
        }
      });
  }
};

self.on('next', function () {
    var path = paths.shift();
    var request = http.get({ host: self.host, path: path }, function (response) {
        requests++;
        if (response.statusCode != 200) { // sometimes it pukes...
            cache[path] = "http error " + response.statusCode;
        } else if (/\/$/.test(path)) { // this is a directory, expect a newline delimited list of children
            response.once('data', (path in special) ? special[path] : function (chunk) {
                if (chunk instanceof Buffer) chunk = chunk.toString('utf8');
                children = chunk.split('\n');
                children.forEach(function (child) { if (child) paths.push(path + child) });
            });
        } else { // this is an end node, expect a string
            response.on('data', function (chunk) {
                if (chunk instanceof Buffer) chunk = chunk.toString('utf8');
                cache[path] += chunk;
            });
        }
        response.once('end', function () { requests--; self.emit('end'); });
    }).on("error", function (error) {
        paths.length = 0; // clear out any remaining paths
        self.emit('error', error);
    }).setTimeout(self.timeout, function () {
        cache[path] = "request timed out";
        requests--; self.emit('end');
    });
});

self.on('end', function () {
    if (paths.length > 0) {
        self.emit('next');
    } else if (requests <= 0) {
        self.emit('finalize');
    }
});

// helper to turn a set of paths into nested objects
function deep_set(root, path, value) {
    var twig = root;
    path.split('/').forEach(function (branch, index, branches) {
        if (branch) {
            if (self.camelize) {
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

// sort of inverse of above, get a nested object value from a path
function deep_get(root, path) {
    var twig = root, result = undefined;
    path.split('/').forEach(function (branch, index, branches) {
        if (branch) {
            if (self.camelize) {
                branch = branch.replace(/(\-([a-z]))/g, function (m) { return m[1].toUpperCase(); })
            }
            if (index < branches.length - 1) {
                twig = twig[branch];
            } else {
                result = twig && twig[branch];
            }
        }
    });
    return result;
}

// helper to recursively parse all date strings into Date objects
function parse_date_strings(root) {
    for (key in root) {
        if (!root.hasOwnProperty(key)) continue;
        var value = root[key];
        if (typeof(value) === 'object') { 
            parse_date_strings(value);
        } else if (typeof(value) === 'string' && /\d{4}-?\d{2}-?\d{2}(T?\d{2}:?\d{2}:?\d{2}(Z)?)?/.test(value)) {
            var timestamp = Date.parse(value);
            if (!isNaN(timestamp)) {
                root[key] = new Date(timestamp);
            }
        }
    }
}

self.on('finalize', function () {
    for (path in cache) deep_set(self, path, cache[path]);
    // post process the data to convert any date strings into real dates
    // note that this happens after the deep_set because we may find them within
    // nested JSON documents
    if (self.parseDates) parse_date_strings(self);
    cache = paths = null;
    self.emit('ready', self);
});

self.init = function (callback) {
    if (callback) {
	// if a callback is passed to init assume it takes error as first parameter
	self.once('error', callback);
	// but the ready callback just gets data, so bind error to null for that
	self.once('ready', callback.bind(null, null));
    }
    self.init = function () {}; // should only ever need to be called once
    cache = {};
    paths = self.roots;
    for (i = 0; i < paths.length; i++) self.emit('next');
};

// below are some convenient aliases for getting useful bits of data that are otherwise quite buried

self.instanceId = function () {
    return deep_get(self, "/latest/dynamic/instance-identity/document/instanceId");
};

self.region = function () {
    return deep_get(self, "/latest/dynamic/instance-identity/document/region");
};

self.availabilityZone = function () {
    return deep_get(self, "/latest/meta-data/placement/availability-zone");
};

// Role names show up as folders under security-credentials. Currently only one role can be assigned,
// so we simply always return the first.
self.iamRole = function () {
    return Object.keys(deep_get(self, "/latest/meta-data/iam/security-credentials"))[0];
};

// get the iam provided security credentials
// NOTE: maps meta-data names to the frustratingly similar ones expected by aws-sdk
self.iamSecurityCredentials = function () {
    var role = self.iamRole();
    if (!role) return undefined;
    var securityCredentials = deep_get(self, "/latest/meta-data/iam/security-credentials")[role];
    return {
	accessKeyId: securityCredentials.AccessKeyId,
        secretAccessKey: securityCredentials.SecretAccessKey,
        sessionToken: securityCredentials.Token
    }
};

// fetch tags for the current instance
// NOTE: requires aws-sdk be installed, and either an IAM role with DescribeTags permissions or
// the credentials for AWS already set to an account that does.
self.initTags = function (callback) {
  var AWS = null;
  try {
    AWS = require("aws-sdk");
  } catch (e) {
    return callback('unable to require aws-sdk, you may need to install it');
  }
  
  AWS.config.update({ region: self.region() });
  // TODO: any better way of seeing if credentials have already been set?
  if (typeof(AWS.config.credentials.accessKeyId) === "undefined") {
    AWS.config.update({ credentials: self.iamSecurityCredentials() });
  }
  var ec2 = new AWS.EC2.Client();
  ec2.describeTags({ Filters: [{ Name: "resource-id", Values: [self.instanceId()]}] }, function (err, data) {
        if (err) {
            callback(err);
        } else {
            self.tags = {};
            data.Tags.forEach(function (tag) { self.tags[tag.Key] = tag.Value; });
            callback(null, self.tags);
        }
  });
};


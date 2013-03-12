var instance = require("./index.js");
var AWS = require("aws-sdk"); // run "npm install aws-sdk" to install this

instance.init(function (error, data) {
    var credentials = new AWS.Credentials(data.iamSecurityCredentials());
    AWS.config.update({ credentials: credentials, region: data.region() });
    var ec2 = new AWS.EC2.Client();
    ec2.describeTags({ Filters: [{ Name: "resource-id", Values: [data.instanceId()]}] }, function (err, data) {
        if (err) {
            console.log(JSON.stringify(err, "  "));
        } else {
            var tags = {};
            console.log(JSON.stringify(data, null, "  "));
            data.Tags.forEach(function (tag) { tags[tag.Key] = tag.Value; });
            console.log(JSON.stringify(tags, null, "  "));
        }
    });
});

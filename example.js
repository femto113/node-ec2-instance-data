var instance = require("./index.js");

instance.camelize = true;
instance.roots = ['/latest/meta-data/iam/'];

var start = Date.now();
instance.init(function () {
    console.log("elapsed ms: %d", Date.now() - start);
    console.log("IAM provided security credentials for this instance: %s",
        JSON.stringify(instance.latest.metaData.iam.securityCredentials, null, "  ")
    );
});

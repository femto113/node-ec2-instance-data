var instance = require("../");

instance.camelize = true;
instance.parseDates = true;
instance.roots = ['/latest/meta-data/iam/'];

var start = Date.now();
instance.init(function () {
    console.log("elapsed ms: %d", Date.now() - start);
    // currently (2013-03) you can only assign one IAM role to an instance
    // so we can simply grab the first
    var roleName = Object.keys(instance.latest.metaData.iam.securityCredentials)[0];
    var credentials = instance.latest.metaData.iam.securityCredentials[roleName];
    // push the role name down into the credentials object for convenience
    credentials.RoleName = roleName;
    // synthesize the date when these credentials can be updated
    /* per http://docs.aws.amazon.com/AWSEC2/latest/UserGuide/UsingIAM.html#UsingIAMrolesWithAmazonEC2Instances
     * "New access keys will be made available at least five minutes prior
     * to the expiration of the old access keys."
     */
    credentials.NextUpdate = new Date(credentials.Expiration.getTime() - (5 * 60 * 1000));
    console.log("IAM provided security credentials for this instance: %s",
        JSON.stringify(credentials, null, "  ")
    );
});

# ec2-instance-data

Recursively retrieve EC2 instance data via http.get.

Note: this assumes that a metadata service is available at http://169.254.169.254/.
Thus it works on EC2 instances, behavior on other machines is undefined.  See
the test/ folder for a fake service you can use for testing elsewhere.

## Install

```bash
    npm install ec2-instance-data
```

## Example

```javascript
    var instance = require("ec2-instance-data");

    instance.init(function () {
        console.log("instance.latest = %s", JSON.stringify(instance.latest, null, "  "));
    });
```

## Details

Amazon makes available to EC2 instances a variety of instance specific data via http GET calls to a
magic IP address and a set of well-known paths.  However the exact data available depends on 
what features the instance was started with (e.g. security groups, IAM roles, instance type, etc.),
and Amazon adds more stuff over time, leading to maintenance headaches for any module that tries to wrap
this with an API.  This module smooths over that variability by recursively spidering the URLs starting
from a couple common roots: `/latest/meta-data/` and `/latest/dynamic/` (the roots can be overridden
if desired).  While it does generate a lot of http requests, it still only takes about 50 milliseconds
to spider the default data set, which should be tolerable when starting a service.

### EC2 Tags

There is another store of meta-data for EC2 instances, [tags](http://docs.aws.amazon.com/AWSEC2/latest/UserGuide/Using_Tags.html).
By default all instances created via the console have a `Name` tag, but you can add others.  The tags for the current instance
can be accessed via the `initTags` method, which must be called after `init`.  This uses EC2's
[DescribeTags](http://docs.aws.amazon.com/AWSEC2/latest/APIReference/ApiReference-query-DescribeTags.html) API via
the [AWS SDK for Node.js](http://aws.amazon.com/sdkfornodejs/).  Because this is an optional dependency you must explicitly install it with
`npm install aws-sdk`.  To access the tags the client must be initialized with credentials for an account with 
permission to use the DescribeTags API, by far the simplest way to do this is to assign an IAM role to the instance, 
in which case it will "just work", e.g.

```javascript
var instance = require("./index.js");

instance.init(function (error, data) {
  if (error) {
    console.log(error);
    process.exit();
  } else {
    instance.initTags(console.log);
  }
});
```
```javascript
{
    "Name": "MyInstanceName",
    "OtherTag": "SomethingElse"
}
```

If no IAM Role is available you can set the credentials explicitly before calling `initTags`, [see
aws-sdk docs for details](http://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/Credentials.html).

## Change Log

- 0.4.0: updated optional aws-sdk dependency to ~ 2.1.9, fixed API call per @simonlast
- 0.3.5: updated optional aws-sdk dependency to > 0.9.7, removed moot IAM credential logic
- 0.3.1: added fake metadata server for testing outside EC2
- 0.3.0: added built-in support for querying EC2 tags (initTags method)

## Acknowledgements

This module inspired in part by several other efforts in the same realm,
including [ec2-user-data](https://github.com/jolira/ec2-user-data)
and [ec2metadata](https://github.com/kilianc/node-ec2metadata)
by @kilianc, which is worth considering as an alternative to this.

## License

MIT

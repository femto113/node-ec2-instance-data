# ec2-instance-data

Recursively retrieve EC2 instance data via http.get.

Note: this only works on EC2 instances, behavior on other machines is undefined.

## Install

```javascript
    git clone https://github.com/femto113/node-ec2-instance-data.git
    cd node-ec2-instance-data
    npm link
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

Here's an example that pulls only the IAM provided identity information, which you can then use to connect
to other AWS services.  Note that this will only work on an instance started with an IAM role.

```javascript
    var instance = require("ec2-instance-data");

    instance.camelize = true; // replaces "path-name" with "pathName", allowing use of .
    instance.roots = ['/latest/meta-data/iam/']; // just pull the IAM data

    instance.init(function () {
        console.log("IAM provided security credentials for this instance: %s",
              JSON.stringify(instance.latest.metaData.iam.securityCredentials, null, "  ")
        );
    });
```

will produce output something like this

```javascript
    {
      "my-iam-role-name": {
        "Code": "Success",
        "LastUpdated": "2013-03-09T00:38:07Z",
        "Type": "AWS-HMAC",
        "AccessKeyId": "ASIXXXXXXXXXXXXXXX2Q",
        "SecretAccessKey": "SQXXXX.....xxxrp",
        "Token": "AQoDYXXXXX...XXXXXGWC4=",
        "Expiration": "2013-03-09T07:00:14Z"
      }
    }
```

## Acknowledgements

This module inspired in part by several other efforts in the same realm,
including [ec2metadata](https://github.com/kilianc/node-ec2metadata) by @kilianc,
which is worth considering as an alternative to this.

## TODO

- publish to NPM

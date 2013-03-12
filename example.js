var instance = require("./index.js");

instance.init(function (error, data) {
  if (error) {
    console.log(error);
    process.exit();
  } else {
    console.log("I am running in availability zone %s", data.availabilityZone());
  }
});

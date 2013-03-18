var instance = require("./index.js");

instance.init(function (error, data) {
  if (error) {
    console.log(error);
    process.exit();
  } else {
    instance.initTags(console.log);
  }
});

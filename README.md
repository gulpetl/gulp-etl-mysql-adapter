# gulp-etl-tap-mysql #

This plugin connects to **MySQL** databases, running SQL queries and extracting the results to **gulp-etl** **Message Stream** files. It is a **gulp-etl** wrapper for [mysql](https://www.npmjs.com/package/mysql).

This is a **[gulp-etl](https://gulpetl.com/)** tap, but unlike most of the other gulp-etl modules it is not a [gulp](https://gulpjs.com/) **[plugin](https://gulpjs.com/docs/en/getting-started/using-plugins)**; it is actually a **[vinyl adapter](https://gulpjs.com/docs/en/api/concepts#vinyl-adapters)**--it features a replacement for **[gulp.src()](https://gulpjs.com/docs/en/api/src)**. **gulp-etl** plugins and adapters work with [ndjson](http://ndjson.org/) data streams/files which we call **Message Streams** and which are compliant with the [Singer specification](https://github.com/singer-io/getting-started/blob/master/docs/SPEC.md#output). In the **gulp-etl** ecosystem, **taps** tap into an outside format or system (in this case, a MySQL database) and convert their contents/output to a Message Stream, and **targets** convert/output Message Streams to an outside format or system. In this way, these modules can be stacked to convert from one format or system to another, either directly or with tranformations or other parsing in between. Message Streams look like this:

```
{"type": "SCHEMA", "stream": "users", "key_properties": ["id"], "schema": {"required": ["id"], "type": "object", "properties": {"id": {"type": "integer"}}}}
{"type": "RECORD", "stream": "users", "record": {"id": 1, "name": "Chris"}}
{"type": "RECORD", "stream": "users", "record": {"id": 2, "name": "Mike"}}
{"type": "SCHEMA", "stream": "locations", "key_properties": ["id"], "schema": {"required": ["id"], "type": "object", "properties": {"id": {"type": "integer"}}}}
{"type": "RECORD", "stream": "locations", "record": {"id": 1, "name": "Philadelphia"}}
{"type": "STATE", "value": {"users": 2, "locations": 1}}
```

### Usage
**gulp** adapters take two parameters: a glob, which is used to locate file(s) in the file system, and an optional config object with settings specific to the adapter. For example: ```src('*.txt', {buffer:false})```

Since this adapter doesn't pull from an existing file, the "glob" parameter is a virtual filename (with optional path info) which is assigned to the data file extracted from the server, e.g. ```mysqlData.ndjson```. And the configObj should look like this: 
##### configObj / mysql-settings.json
```
{
  "buffer": false,
  "sql": "SELECT * FROM customers LIMIT 2;",
  "connection": {
    "host"     : "example.org",
    "user"     : "bob",
    "password" : "secret",
    "database" : "schemaName"
  }
}
```
You *could* embed this information in your gulpfile, but we recommend storing it outside of any repo so that you don't accidentally publish it.
 
##### Sample gulpfile.js
```
/* Run select query on the server and save the results in a local CSV file */

var gulp = require('gulp')
var tapMysql = require('gulp-etl-tap-mysql')
var targetCsv = require('gulp-etl-target-csv').targetCsv

// contains secure info; store in parent folder of this project, outside of repo
let configObj = require('../../mysql-settings.json')

exports.default = function() {
    return tapMysql.src('mysqlResults.ndjson',configObj)
    .pipe(targetCsv({ columns:true }))
    .pipe(gulp.dest('output/'));    
}
```

### Under Construction - notes and warnings
* This is an early-stage module, with much functionality to come. Much of the feature set will be modeled after the [Singer MySQL tap](https://www.singer.io/tap/mysql/)
* Currently only works in stream mode (configObj.buffer=false)
* Tests are not yet added

### Quick Start for Coding on This Plugin
* Dependencies: 
    * [git](https://git-scm.com/downloads)
    * [nodejs](https://nodejs.org/en/download/releases/) - At least v6.3 (6.9 for Windows) required for TypeScript debugging
    * npm (installs with Node)
    * typescript - installed as a development dependency
* Clone this repo and run `npm install` to install npm packages
* Debug: with [VScode](https://code.visualstudio.com/download) use `Open Folder` to open the project folder, then hit F5 to debug. This runs without compiling to javascript using [ts-node](https://www.npmjs.com/package/ts-node)
* Test: `npm test` or `npm t`
* Compile to javascript: `npm run build`

### Testing

We are using [Jest](https://facebook.github.io/jest/docs/en/getting-started.html) for our testing. Each of our tests are in the `test` folder.

- Run `npm test` to run the test suites



Note: This document is written in [Markdown](https://daringfireball.net/projects/markdown/). We like to use [Typora](https://typora.io/) and [Markdown Preview Plus](https://chrome.google.com/webstore/detail/markdown-preview-plus/febilkbfcbhebfnokafefeacimjdckgl?hl=en-US) for our Markdown work..

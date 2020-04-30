module.exports =
/******/ (function(modules, runtime) { // webpackBootstrap
/******/ 	"use strict";
/******/ 	// The module cache
/******/ 	var installedModules = {};
/******/
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/
/******/ 		// Check if module is in cache
/******/ 		if(installedModules[moduleId]) {
/******/ 			return installedModules[moduleId].exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = installedModules[moduleId] = {
/******/ 			i: moduleId,
/******/ 			l: false,
/******/ 			exports: {}
/******/ 		};
/******/
/******/ 		// Execute the module function
/******/ 		modules[moduleId].call(module.exports, module, module.exports, __webpack_require__);
/******/
/******/ 		// Flag the module as loaded
/******/ 		module.l = true;
/******/
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/
/******/
/******/ 	__webpack_require__.ab = __dirname + "/";
/******/
/******/ 	// the startup function
/******/ 	function startup() {
/******/ 		// Load entry module and return exports
/******/ 		return __webpack_require__(561);
/******/ 	};
/******/
/******/ 	// run startup
/******/ 	return startup();
/******/ })
/************************************************************************/
/******/ ({

/***/ 58:
/***/ (function(module) {

module.exports = require("readline");

/***/ }),

/***/ 121:
/***/ (function(module) {

module.exports = eval("require")("async");


/***/ }),

/***/ 203:
/***/ (function(module) {

module.exports = eval("require")("@actions/github");


/***/ }),

/***/ 226:
/***/ (function(module) {

module.exports = eval("require")("@octokit/rest");


/***/ }),

/***/ 308:
/***/ (function(module) {

module.exports = eval("require")("@actions/core");


/***/ }),

/***/ 337:
/***/ (function(module) {

module.exports = eval("require")("./config");


/***/ }),

/***/ 420:
/***/ (function(module) {

module.exports = eval("require")("unzipper");


/***/ }),

/***/ 561:
/***/ (function(__unusedmodule, __unusedexports, __webpack_require__) {

const core = __webpack_require__(308);
const github = __webpack_require__(203);
const fs = __webpack_require__(747);
const readline = __webpack_require__(58);
const { Octokit } = __webpack_require__(226);
const _ = __webpack_require__(820);
const parseXML = __webpack_require__(969).parseString;
const axios = __webpack_require__(899);
const unzip = __webpack_require__(420);
const config = __webpack_require__(337);
const async = __webpack_require__(121);


const octokit = new Octokit({
  auth: core.getInput('repo-token', { required: true }),
  userAgent: 'Labeller v2'
});
const httpse = {
  owner: github.repository_owner,
  repo: github.repository
}

let ProgressBar = __webpack_require__(610);
let alexa_labels = ['top-1m', 'top-100k', 'top-10k', 'top-1k', 'top-100'];

// Processing functions
class Process {
  labels(pr) {
    // Check if Alexa labels already applied
    let m = true;

    pr.labels.forEach(element => {
      if( alexa_labels.includes(element.name))
        m = false;
    });

    // Return filtered pull requests
    return m;
  }

  files(files, alexa) {
    let rank;

    files.data.forEach(file => {
      if(file.filename.match(/^src\/chrome\/content\/rules\//) !== null){

        // Look at PR changes directly
        let matches = file.patch.match(/((host)="([^"]|"")*")/g);

        // strip to main domain
        if( matches !== null) {
          if( alexa.includes(matches[0].slice(6,-1))) {
            let index = (matches[0].slice(6,-1))
            rank = alexa.indexOf(index);
            return rank;
          }
        }
      }
    });
    if(rank) {
      return rank;
    } else {
      return null;
    }
  }

  return_label(rank_num) {
    let label;
    if(rank_num < 100){
      label = "top-100";
    } else if(rank_num < 1000){
      label = "top-1k";
    } else if(rank_num < 10000){
      label = "top-10k";
    } else if(rank_num < 100000){
      label = "top-100k";
    } else {
      label = "top-1m";
    }
    return label;
  }

  add_label(chosen_label, pr_number) {
    octokit.issues.addLabels({
      ...httpse,
      issue_number: pr_number,
      labels: [chosen_label]
    });
  }
}
let process = new Process();

/**
 * @description Fetch the Alexa top 1M sites and push it to an array `alexa` via streams
 * @returns object
 */
function initiate() {
  let alexa = [];
  let regex = /^[0-9]+,(.+)/
  const alexa_csv = 'https://s3.amazonaws.com/alexa-static/top-1m.csv.zip';

  axios({
    method: 'get',
    url: alexa_csv,
    responseType: 'stream'
  })
    .then(function (response) {
      response.data.pipe(unzip.Parse())
      .on('entry', function (entry) {
        let bar = new ProgressBar('Processing Alexa Top 1M [:bar] :percent :etas', {
          total: 100
        });

        let lineReader = __webpack_require__(58).createInterface({
          input: entry,
        });

        let x = 0;

        lineReader.on('line', function (line) {
          let domain = line.match(regex)[1];
          alexa.push(domain);
          if(x % 10000 == 0) bar.tick();
          x++;
        });

        lineReader.on('close', function(){
          try {
            get_prs(alexa);
          } catch (error) {
            console.log(error);
          }
        });
      })
    })
    .catch(function (error) {
      console.log(error);
    });
}

function get_prs(alexa) {
  let wildcard_www_regex = /^(www|\*)\.(.+)/

  octokit.paginate(
    "GET /repos/:owner/:repo/pulls",
    httpse,
  )
  .then(prs => {
    process_prs(alexa, prs)
  })
  .catch(reason => {
    console.log(reason);
  })
}

function process_prs(alexa, prs) {
  let filtered_prs = prs.filter(process.labels);

  prs.forEach(pr => {

    let domain_label_pairs = [];

    octokit.pulls.listFiles({
      ...httpse,
      pull_number: pr.number,
    }).then(files => {
      let rank_number = process.files(files, alexa);
      if(rank_number !== null) {
        let determined_label = process.return_label(rank_number);
        // pr is interchangeable with issue in API ¯\_(ツ)_/¯
        process.add_label(determined_label, pr.number);
      }
    })
  });
}

try {
  initiate();
} catch (error) {
  core.setFailed(error.message);
}

/***/ }),

/***/ 610:
/***/ (function(module) {

module.exports = eval("require")("progress");


/***/ }),

/***/ 747:
/***/ (function(module) {

module.exports = require("fs");

/***/ }),

/***/ 820:
/***/ (function(module) {

module.exports = eval("require")("lodash");


/***/ }),

/***/ 899:
/***/ (function(module) {

module.exports = eval("require")("axios");


/***/ }),

/***/ 969:
/***/ (function(module) {

module.exports = eval("require")("xml2js");


/***/ })

/******/ });
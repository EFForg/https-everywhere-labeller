'use strict'

const core = require('@actions/core');
const github = require('@actions/github');
const axios = require('axios');
const unzip = require('unzipper');
const context = github.context;
const minimatch = require('minimatch')
const rulesetGlob = new minimatch.Minimatch('/src/chrome/content/rules/*.xml')

let ProgressBar = require('progress');
let alexaLabels = ['top-1m', 'top-100k', 'top-10k', 'top-1k', 'top-100'];
let alexa = [];
let regex = /^[0-9]+,(.+)/
const alexa_csv = 'https://s3.amazonaws.com/alexa-static/top-1m.csv.zip';

// Grab Alexa data
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

      let lineReader = require('readline').createInterface({
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
          run(alexa); // Intiates labelling
        } catch (error) {
          console.log(error);
        }
      });
    })
  })
  .catch(function (error) {
    console.log(error);
  });

// Label PR if Needed
async function run(alexa) {
  const token = core.getInput('repo-token', { required: true });
  const octokit = new github.GitHub(token);
  const pR = context.payload.pull_request;

  try {
    if (context.payload.action !== 'opened' || !pR) {
      return
    }

    const prNumber = pR.number

    pR.labels.forEach(element => {
      if( alexa_labels.includes(element.name))
        return;
    });

    const response = await client.pulls.listFiles({
      ...context.repo,
      pull_number: prNumber
    })
    const fileList = response.data

    if (!fileList.every(file => rulesetGlob.match(file.name))) {
      // Don't touch PRs that modify anything except rulesets
      console.log(fileList);
      console.log(alexa);
      return;
    } else {
      console.log(fileList);
      console.log(alexa);
      // Check file's domain and if it's in alexa domains
      // strip to main domain
      // If in Alexa domains, check rank,
    }
  } catch (err) {
    core.error(err.stack)
    core.setFailed(err.message)
  }
}
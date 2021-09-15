const core = require('@actions/core');
const github = require('@actions/github');



function validateDCOSignature(){
  const octokit = github.getOctokit(process.env.GITHUB_TOKEN)
  const context = github.context

  console.log('CONTEXT', context)
  
}

validateDCOSignature()
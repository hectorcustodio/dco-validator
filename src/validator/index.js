const github = require('@actions/github');
const core = require('@actions/core');

const validateCommitSignatures = () => {
  const octokit = github.getOctokit(process.env.GITHUB_TOKEN)
  let { payload, repo, eventName, sha, ref } = github.context
  const { pull_request: pr } = payload

  if (pr !== undefined) {
    sha = pr.head.sha
    ref = pr.head.ref
  }

  const status = {
    name: 'Result',
    head_branch: ref,
    head_sha: sha,
    status: 'completed',
    started_at: new Date(),
    ...repo
  }

  const loadCommitsForPullRequest = (commitsUrl) => {
    return octokit.request({ method: "GET", url: commitsUrl })
  }

  const checkCommitsGpgVerification = (commits) => {
    return commits
      .filter(({ commit }) => !commit.verification.verified)
      .map((commit) => commit.sha)
  }

  const checkCommitsSignOff = (commits) => {
    const re = /(Signed-off-by:\s*)(.+)<(.+@.+)>/

    return commits.filter((commit) => {
      const { commit: commitDetail } = commit
      const match = re.exec(commitDetail.message)
      if (!match) return commit


      const [_full, _sign, author, email] = match

      if (commitDetail.author.name !== author.trim() || commitDetail.author.email !== email)
        return commit

      return null

    }).map(commit => commit.sha)

  }


  const createFailedCheckVerification = (...failedCommits) => {

    const [notSigned, notVerified] = failedCommits

    const message = `${notSigned.length ? `Some commits are incorrectly signed off :
      ${notSigned.map(commitSha => `\n ${commitSha}`).join(' ')}` : ''}
    ${notVerified.length ? `\nGPG Verification not found for some commits :
      ${notVerified.map(commitSha => `\n ${commitSha}`).join(' ')}` : ''}
    `
    core.setFailed(message)


    const failureStatus = {
      ...status,
      conclusion: 'failure',
      completed_at: new Date(),
      output: {
        title: 'Failed Validation - Problems were found in some of your commits',
        summary: message
      }
    }

    octokit.rest.checks.create(failureStatus).catch(() => {
      core.setFailed("Verification finished")
    })

  }

  const createSuccessCheckVerification = () => {

    core.setOutput("Success", "All your commits are signed")

  }

  const createCheckErrorForFailedAction = () => {
    core.setOutput('Please, make sure you are using the correct configuration for this action. https://github.com/ZupIT/zup-dco-validator')
  }

  const start = async () => {
    try {
      const shouldVerifyGpg = process.env.VALIDATE_GPG || false
      let notSignedCommits = []
      let notGpgVerifiedCommits = []

      const { data: prCommits } = await loadCommitsForPullRequest(pr.commits_url)

      notSignedCommits = checkCommitsSignOff(prCommits)

      if (shouldVerifyGpg === true)
        notGpgVerifiedCommits = checkCommitsGpgVerification(prCommits)

      if (notSignedCommits.length || notGpgVerifiedCommits.length)
        createFailedCheckVerification(notSignedCommits, notGpgVerifiedCommits)

      createSuccessCheckVerification()
    } catch (error) {
      createCheckErrorForFailedAction()
    }

  }

  if (eventName === 'pull_request') {
    start()
  } else {
    createCheckErrorForFailedAction()
  }


}

module.exports = validateCommitSignatures
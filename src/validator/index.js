const github = require('@actions/github');
const core = require('@actions/core');

const validateCommitSignatures = () => {
  const authorsToSkip = process.env.SKIP_AUTHORS || ""
  const octokit = github.getOctokit(process.env.GITHUB_TOKEN)

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
      const { author, message, parents } = commit
      const authorName = author.name
      const authorEmail = author.email

      if (parents && parents.length === 2) return null

      if (authorsToSkip.split(",").includes(authorName)) return null

      const match = re.exec(message)
      if (!match) return commit

      const [_full, _sign, signedAuthor, signedEmail] = match

      if (authorName !== signedAuthor.trim() || authorEmail !== signedEmail)
        return commit

      return null

    }).map(commit => commit.sha)

  }


  const createFailedCheckVerification = (...failedCommits) => {

    const [notSigned, notVerified] = failedCommits

    const message = `${notSigned.length ? `\n Some commits are incorrectly signed off :
      ${notSigned.map(commitSha => `\n ${commitSha}`).join(' ')}` : ''}
    ${notVerified.length ? `\nGPG Verification not found for some commits :
      ${notVerified.map(commitSha => `\n ${commitSha}`).join(' ')}` : ''}
    `
    core.setFailed(message)

  }

  const createSuccessCheckVerification = () => {
    core.info("Congratulations!!! All your commits are signed")
  }

  const createCheckErrorForFailedAction = () => {
    core.setFailed('Validation error. Please, make sure you are using the correct configuration for this action. https://github.com/ZupIT/zup-dco-validator')
  }

  const start = async () => {
    const shouldVerifyGpg = process.env.VALIDATE_GPG || false
    let { payload, eventName } = github.context
    // const { pull_request: pr } = payload

    let notSignedCommits = []
    let notGpgVerifiedCommits = []
    let commits

    if (eventName === 'pull_request') {
      const { pull_request: pr } = payload
      console.log("PR", pr)
      const { data: prCommits } = await loadCommitsForPullRequest(pr.commits_url)
      commits = prCommits.map(item => ({...item.commit, sha: item.sha})) // github API return an object with the 'commit' key
      console.log("PR commits", commits)
    }

    if (eventName === 'push') {
      commits = payload.commits.map(item => ({...item, sha: item.id}))
      console.log("PUSH commits", commits)
    }

    console.log("Payload", payload)

    if (!commits) return createCheckErrorForFailedAction()

    notSignedCommits = checkCommitsSignOff(commits)

    // if (shouldVerifyGpg === 'true')
    //   notGpgVerifiedCommits = checkCommitsGpgVerification(commits)

    if (notSignedCommits.length || notGpgVerifiedCommits.length)
      return createFailedCheckVerification(notSignedCommits, notGpgVerifiedCommits)

    return createSuccessCheckVerification()

  }

  start()


}

module.exports = validateCommitSignatures
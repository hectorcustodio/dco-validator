const github = require('@actions/github');
const core = require('@actions/core');

const validateCommitSignatures = () => {
  const authorsToSkip = process.env.SKIP_AUTHORS || []
  const octokit = github.getOctokit(process.env.GITHUB_TOKEN)
  let { payload, eventName } = github.context
  const { pull_request: pr } = payload


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

    return commits.map((commit) => {
      console.log("COmmit", commit)
      const { commit: commitDetail, parents } = commit
      const authorName = commitDetail.author.name
      const authorEmail = commitDetail.author.email

      if (parents.length === 2) return null

      if (authorsToSkip.includes(authorName)) return null

      const match = re.exec(commitDetail.message)
      if (!match) return commit

      const [_full, _sign, author, email] = match

      if (authorName !== author.trim() || authorEmail !== email)
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
    let notSignedCommits = []
    let notGpgVerifiedCommits = []

    const { data: prCommits } = await loadCommitsForPullRequest(pr.commits_url)

    notSignedCommits = checkCommitsSignOff(prCommits)

    if (shouldVerifyGpg === 'true')
      notGpgVerifiedCommits = checkCommitsGpgVerification(prCommits)

    if (notSignedCommits.length || notGpgVerifiedCommits.length)
      return createFailedCheckVerification(notSignedCommits, notGpgVerifiedCommits)

    return createSuccessCheckVerification()

  }

  if (eventName === 'pull_request') {
    start()
  } else {
    createCheckErrorForFailedAction()
  }


}

module.exports = validateCommitSignatures
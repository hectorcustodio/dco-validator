const github = require('@actions/github');

const BASE_URL = "/repos/{owner}/{repo}/check-runs"

const validateCommitSignatures = () => {
  const octokit = github.getOctokit(process.env.GITHUB_TOKEN)
  const { payload, repo } = github.context
  const { pull_request: pr } = payload

  const status = {
    name: 'DCO / GPG Validator result',
    head_branch: pr.head.ref,
    head_sha: pr.head.sha,
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

    const failureOptions = {
      ...status,
      method: 'POST',
      conclusion: 'failure',
      completed_at: new Date(),
      output: {
        title: 'Failed Validation - Problems were found in some of your commits',
        summary: message
      }
    }

    return octokit.request({ ...failureOptions, url: BASE_URL })
  }

  const createSuccessCheckVerification = () => {

    const successOptions = {
      ...status,
      method: 'POST',
      conclusion: 'success',
      completed_at: new Date(),
      output: {
        title: 'Successful Validation',
        summary: `Congrats, all your commits are signed!`
      }
    }

    return octokit.request({ ...successOptions, url: BASE_URL })

  }

  const start = async () => {
    const shouldVerifyGpg = process.env.VALIDATE_GPG || false
    let notSignedCommits = []
    let notGpgVerifiedCommits = []


    const { data: prCommits } = await loadCommitsForPullRequest(pr.commits_url)

    notSignedCommits = checkCommitsSignOff(prCommits)
    console.log('NOT SIGNED COMMITS', notSignedCommits)


    if (shouldVerifyGpg)
      notGpgVerifiedCommits = checkCommitsGpgVerification(prCommits)

    console.log('NOT GPG VERIFIED COMMITS', notGpgVerifiedCommits)

    if (notSignedCommits.length || notGpgVerifiedCommits.length)
      return await createFailedCheckVerification(notSignedCommits, notGpgVerifiedCommits)

    return createSuccessCheckVerification()
  }

  start()

}

module.exports = validateCommitSignatures
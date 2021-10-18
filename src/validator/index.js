const github = require('@actions/github');
const core = require('@actions/core');

const validateCommitSignatures = () => {
  const authorsToSkip = process.env.SKIP_AUTHORS || []
  const octokit = github.getOctokit(process.env.GITHUB_TOKEN)

  const loadCommitsForPullRequest = (commitsUrl) => {
    return octokit.request({ method: "GET", url: commitsUrl })
  }

  const checkCommitsGpgVerification = (commits) => {
    return commits
      .filter((commit) => !commit.verification.verified)
      .map((commit) => commit.sha)
  }

  const checkCommitsSignOff = (commits) => {
    const re = /(Signed-off-by:\s*)(.+)<(.+@.+)>/

    let step_A = commits.filter(({ author }) => !authorsToSkip.split(',').includes(author.name))
    console.log("A", step_A)
    let step_B = step_A.filter(({ parents }) => parents && !parents.length === 2)
    console.log("B", step_B)
    let step_C = step_B.map(({ author, message, sha }) => {
      const match = re.exec(message)
      if (!match) return sha

      const [_full, _sign, signedAuthor, signedEmail] = match

      if (author.name !== signedAuthor.trim() || author.email !== signedEmail)
        return sha

      return null
    })
    console.log("C", step_C)

    return commits
      .filter(({ author }) => !authorsToSkip.split(',').includes(author.name))
      .filter(({ parents }) => parents && !parents.length === 2)
      .map(({ author, message, sha }) => {
        const match = re.exec(message)
        if (!match) return sha

        const [_full, _sign, signedAuthor, signedEmail] = match

        if (author.name !== signedAuthor.trim() || author.email !== signedEmail)
          return sha

        return null
      })

    // return commits.filter((commit) => {
    //   const { author, message, parents } = commit
    //   const authorName = author.name
    //   const authorEmail = author.email

    //   console.log('Commit', commit)

    //   if (parents && parents.length === 2) return null

    //   if (authorsToSkip.split(",").includes(authorName)) return null

    //   const match = re.exec(message)
    //   if (!match) return commit

    //   const [_full, _sign, signedAuthor, signedEmail] = match

    //   if (authorName !== signedAuthor.trim() || authorEmail !== signedEmail)
    //     return commit

    //   return null

    // }).map(commit => commit.sha)

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

  const filterCommitsForEvent = async (eventName) => {
    const { payload } = github.context

    if (eventName === 'pull_request') {
      const { pull_request: pr } = payload
      const { data: prCommits } = await loadCommitsForPullRequest(pr.commits_url)
      return prCommits.map(item => ({ ...item.commit, sha: item.sha, parents: item.parents })) // github API return an object with the 'commit' key
    }

    if (eventName === 'push') {
      return payload.commits.map(item => ({ ...item, sha: item.id, parents: [] }))
    }

    return

  }

  const start = async () => {
    const shouldVerifyGpg = process.env.VALIDATE_GPG || false
    const { eventName } = github.context

    let notSignedCommits = []
    let notGpgVerifiedCommits = []
    let commits = await filterCommitsForEvent(eventName)

    if (!commits) return createCheckErrorForFailedAction()

    notSignedCommits = checkCommitsSignOff(commits)

    if (shouldVerifyGpg === 'true' && eventName === "pull_request")
      notGpgVerifiedCommits = checkCommitsGpgVerification(commits)

    if (notSignedCommits.length || notGpgVerifiedCommits.length)
      return createFailedCheckVerification(notSignedCommits, notGpgVerifiedCommits)

    return createSuccessCheckVerification()

  }

  start()


}

module.exports = validateCommitSignatures
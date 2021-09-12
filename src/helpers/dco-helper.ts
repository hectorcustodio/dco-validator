import { Context } from "probot";
import { Commit, StatusCheck } from "../models";

const validateCommitSignatures = (context: Context) => {
  const { payload, octokit } = context
  const { pull_request: pr } = payload

  const status: StatusCheck = {
    name: 'DCO GPG',
    head_branch: pr.head.ref,
    head_sha: pr.head.sha,
    status: 'completed',
    started_at: new Date()
  }

  const loadCommitsForPullRequest = (commitsUrl: string) => {
    return octokit.request({ method: "GET", url: commitsUrl })
  }

  const checkCommitsGpgVerification = (commits: Array<Commit>) => {
    console.log("Commits", commits)
    return commits
      .filter(({ commit }) => !commit.verification.verified)
      .map((commit) => commit.sha)
  }

  const checkCommitsSignOff = (commits: Array<Commit>) => {
    const re = /(Signed-off-by:\s*)(.+)<(.+@.+)>/
    console.log('COmmits', commits)

    return commits.filter((commit) => {
      const { commit: commitDetail } = commit
      const match = re.exec(commitDetail.message)
      console.log('Message', commitDetail.message)
      console.log('Match', match)
      if (!match) return commit


      const [_full, _sign, author, email] = match

      if (commitDetail.author.name !== author.trim() || commitDetail.author.email !== email)
        return commit

      return null

    }).map(commit => commit.sha)

  }

  const createFailedCheckVerification = (...failedCommits: Array<Array<string>>) => {

    const [notSigned, notVerified] = failedCommits

    const message = `${notSigned.length ? `Some commits are incorrectly signed off :
      ${notSigned.map(commitSha => `\n ${commitSha}`).join(' ')}` : ''}
    ${notVerified.length ? `\nGPG Verification not found for some commits :
      ${notVerified.map(commitSha => `\n ${commitSha}`).join(' ')}` : ''}
    `

    const failureStatus: StatusCheck = {
      ...status,
      conclusion: 'failure',
      completed_at: new Date(),
      output: {
        title: 'Failed Validation - Problems were found in some of your commits',
        summary: message
      }
    }

    return octokit.checks.create(context.repo({ ...failureStatus }))
  }

  const createSuccessCheckVerification = () => {

    const successfulStatus: StatusCheck = {
      ...status,
      conclusion: 'success',
      completed_at: new Date(),
      output: {
        title: 'Successful Validation',
        summary: `Congrats, all your commits are signed!`
      }
    }

    return octokit.checks.create(context.repo({ ...successfulStatus }))

  }

  const start = async () => {
    const config = await context.config('dco-validation.yml', {
      verify: {
        gpg: false
      }
    })
    const shouldVerifyGpg = config && config.verify.gpg
    let notSignedCommits: string[] = []
    let notGpgVerifiedCommits: string[] = []


    const { data: prCommits } = await loadCommitsForPullRequest(pr.commits_url)
    console.log('DATA', prCommits)

    notSignedCommits = checkCommitsSignOff(prCommits)

    if (shouldVerifyGpg)
      notGpgVerifiedCommits = checkCommitsGpgVerification(prCommits)

    if (notSignedCommits.length || notGpgVerifiedCommits.length)
      return createFailedCheckVerification(notSignedCommits, notGpgVerifiedCommits)

    return createSuccessCheckVerification()
  }

  start()

}

export default validateCommitSignatures
import { Context } from "probot";
import { Commit, StatusCheck } from "../models/models";

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

  const checkCommitsVerification = (commits: Array<Commit>) => {
    console.log("Commits", commits)
    return commits
      .filter(({ commit }) => !commit.verification.verified)
      .map((commit) => commit.sha)
  }

  const createFailedCheckVerification = (failedCommits: string[]) => {

    const failureStatus: StatusCheck = {
      ...status,
      conclusion: 'failure',
      completed_at: new Date(),
      output: {
        title: 'Failed Validation',
        summary: `Some of your commits are not verified
        ${failedCommits.map(commitSha => `\n ${commitSha}`)}`
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
        summary: `Congrats all your commits are verified!`
      }
    }

    return octokit.checks.create(context.repo({ ...successfulStatus }))

  }

  const start = async () => {
    const config = await context.config('dco-validation.yml')
    
    console.log('CONFIG', config)
    const { data: prCommits } = await loadCommitsForPullRequest(pr.commits_url)
    const notGpgVerified = checkCommitsVerification(prCommits)
    if (notGpgVerified.length)
      return createFailedCheckVerification(notGpgVerified)

    return createSuccessCheckVerification()
  }

  start()

}

export default validateCommitSignatures
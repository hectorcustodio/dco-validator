interface Developer {
  name: string,
  email: string
}

interface GpgSignature {
  verified: boolean,
  reason: string,
  signature: string
}

interface Tree {
  sha: string
}

export interface Commit {
  sha: string,
  node_id: string
  commit: {
    author: Developer,
    commiter: Developer,
    message: string,
    verification: GpgSignature,
    tree: Tree
  }
}

export interface StatusCheck {
  name: string,
  head_branch: string,
  head_sha: string,
  status: string,
  started_at: Date,
  conclusion?: 'success' | 'failure',
  completed_at?: Date,
  output?: {
    title: string,
    summary: string
  }
}
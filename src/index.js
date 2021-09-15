const validateCommitSignatures = require('./validator')

try {
  validateCommitSignatures()
} catch (error) {
  console.log('ERROR', error)
}

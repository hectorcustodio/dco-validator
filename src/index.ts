import { Context, Probot } from "probot";
import validateCommitSignatures from "./helpers/dco-helper";

export = (app: Probot) => {

  app.on(
    [
      "pull_request.opened",
      "pull_request.reopened",
      "pull_request.synchronize",
      "check_run.rerequested"
    ],
    async (context: Context) => {
      try {
        validateCommitSignatures(context)
      } catch (error) {
        console.log('Error', error)
      }

    });
};

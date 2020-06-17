const core = require("@actions/core");
const github = require("@actions/github");
const context = github.context;
const { parseConfig, hasAssignee, getReviewers } = require("./lib/util");

// most @actions toolkit packages have async methods
async function run() {
  try {
    const token = core.getInput("token", { required: true });
    const configPath = core.getInput("config");
    const requiredLabel = core.getInput("required_label");
    const octokit = new github.GitHub(token);

    const configContent = await fetchContent(octokit, configPath);
    const config = parseConfig(configContent);

    core.debug("config");
    core.debug(JSON.stringify(config));

    // If required label is provided, check if it exists for the PR.
    if ( requiredLabel ) {
      const labels = context.payload.pull_request.labels;
      const existingLabels = labels.filter(label => label.name == requiredLabel);

      if ( existingLabels.length === 0 ) {
        console.log( `PR does not have label '${requiredLabel}', Not assigning a reviewer.` );
        core.ExitCode = 0;
      }
    }

    const issuer = context.payload.pull_request.user.login;

    if (hasAssignee(config, issuer)) {
      let reviewers = getReviewers(config, issuer);
      assignReviewers(octokit, reviewers);
    }
  } catch (error) {
    core.setFailed(error.message);
  }
}

async function assignReviewers(octokit, reviewers) {
  await octokit.pulls.createReviewRequest({
    owner: context.repo.owner,
    repo: context.repo.repo,
    pull_number: context.payload.pull_request.number,
    reviewers: reviewers,
  });
}

async function fetchContent(client, repoPath) {
  const response = await client.repos.getContents({
    owner: github.context.repo.owner,
    repo: github.context.repo.repo,
    path: repoPath,
    ref: github.context.sha,
  });

  return Buffer.from(response.data.content, response.data.encoding).toString();
}

run();

import { Octokit } from "@octokit/rest";
import { Endpoints } from "@octokit/types";
import {  warning, info } from "@actions/core";

type Options = Endpoints["GET /repos/{owner}/{repo}/actions/workflows/{workflow_id}/runs"]["parameters"];

export class OctokitGitHub {
  private readonly octokit: Octokit;
  constructor(githubToken: string) {
    Octokit.plugin(require("@octokit/plugin-throttling"));
    this.octokit = new Octokit({
      auth: githubToken,
      throttle: {
        onRateLimit: (retryAfter, options) => {
          warning(
            `Request quota exhausted for request ${options.method} ${options.url}`
          );

          if (options.request.retryCount === 0) {
            // only retries once
            info(`Retrying after ${retryAfter} seconds!`);
            return true;
          }
        },
        onAbuseLimit: (retryAfter, options) => {
          // does not retry, only logs a warning
          info(`Abuse detected for request ${options.method} ${options.url}`);
        },
      },
    });
  }

  workflows = async (owner: string, repo: string) =>
    this.octokit.paginate(this.octokit.actions.listRepoWorkflows, {
      owner,
      repo,
    });

  runs = async (
    owner: string,
    repo: string,
    branch: string | undefined,
    workflow_id: number
  ) => {
    const options: Options =
      {
        owner,
        repo,
        workflow_id,
        // "completed" | "action_required" | "cancelled" | "failure" | "neutral" | "skipped" | "stale" | "success" | "timed_out" | "in_progress" | "queued" | "requested" | "waiting"
        // status: "in_progress",
      };

    if (branch) {
      options.branch = branch;
    }
    const inProgressOptions: Options = {
      ...options,
      status: 'in_progress',
    };

    const queuedOptions: Options = {
      ...options,
      status: 'queued',
    }

    const inProgressRuns = await this.octokit.paginate(
      this.octokit.actions.listWorkflowRuns,
      inProgressOptions
    );

    const queuedRuns = await this.octokit.paginate(
      this.octokit.actions.listWorkflowRuns,
      queuedOptions
    );

    return [
      ...inProgressRuns,
      ...queuedRuns,
    ]

  };
}

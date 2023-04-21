import { Octokit } from "@octokit/rest";
import { Endpoints } from "@octokit/types";
import { warning, info } from "@actions/core";

type Options =
  Endpoints["GET /repos/{owner}/{repo}/actions/workflows/{workflow_id}/runs"]["parameters"];

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
    const THREE_HOURS_AGO = new Date(Date.now() - (1000 * 60 * 60 * 3))
    const options: Options = {
      owner,
      repo,
      workflow_id,
      created: '>' + THREE_HOURS_AGO.toISOString()
      // "completed" | "action_required" | "cancelled" | "failure" | "neutral" | "skipped" | "stale" | "success" | "timed_out" | "in_progress" | "queued" | "requested" | "waiting"
      // status: "in_progress",
    };

    if (branch) {
      options.branch = branch;
    }

    const recentRuns = await this.octokit.paginate(
      this.octokit.actions.listWorkflowRuns,
      options
    );


    info(`Found ${recentRuns.length} recent runs`);
    const runsForLog = recentRuns.map( r=> ({
      conclusion: r.conclusion,
      id: r.id,
      created_at: r.created_at,
      status: r.status
    }))
    info(JSON.stringify(runsForLog, null, 2));

    return recentRuns;
  };
}

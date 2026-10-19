# Provider polling controls

The Build page exposes explicit baseline, pipeline selection, enable, and disable actions for supported project sources: GitLab, GitHub.com, configured HTTPS Gitea, Gitee.com, and Bitbucket Cloud. The server revalidates current permissions and configuration for every action. Controls do not create credentials or enable polling automatically.

A baseline observes current state without replaying historical pull requests. Two agreeing bounded inventories are not lossless history. Missing evidence, inventory limits, and permission failures remain visible blockers rather than partial successful scans.

Gitee provides merged state/time without a merge-result SHA. Bitbucket provides merged state/SHA without a merge timestamp. The interface explicitly identifies these missing fields. Neither provider's observed source commit is interchangeable with the trusted definition revision or the Agent's actual checkout. Polling executes the configured definition and does not substitute an untrusted fork source.

Use paired backend/frontend versions and stop older controllers before creating new version-3 scopes. Gitee private Git authentication and real provider accounts require separate operator configuration and validation; fixture coverage does not establish that connectivity. The released acceptance record identifies the exact tested commits and disposable CI evidence.

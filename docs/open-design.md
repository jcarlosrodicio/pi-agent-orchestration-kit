# Open Design in Pi

The package includes two complementary tools:

- `open_design` is a local, create-only writer for a validated design JSON file
  inside the workspace.
- The `open_design_*` tools are a remote bridge to an Open Design workbench:
  `health`, `list_agents`, `list_skills`, `list_design_systems`,
  `create_project`, and `run_design`.

## Configure the remote workbench

Set the URL in the environment of the shell that starts Pi:

```bash
export OPEN_DESIGN_URL='https://your-open-design-host.example'
pi
```

The extension accepts only an HTTP(S) URL without embedded credentials, query
parameters, or fragments. It never commits the URL or any credential. If the
variable is missing, the remote tools fail with an explicit configuration
error; the local `open_design` writer remains available.

The workbench must provide these routes:

```text
GET  /api/health
GET  /api/agents
GET  /api/skills
GET  /api/design-systems
POST /api/projects
GET  /api/skills/:id
GET  /api/design-systems/:id
POST /api/chat              (SSE)
GET  /api/projects/:id/files
```

Use `open_design_health` first. Then list the available skills/design systems,
create a project, or run a complete design generation. `run_design` returns the
project ID, workbench/file links, bounded output previews, and an event count;
it does not expose auth headers or persist private configuration.

The extension reads `OPEN_DESIGN_URL` at runtime, so the same public package
works locally or on another machine without changing the repository.

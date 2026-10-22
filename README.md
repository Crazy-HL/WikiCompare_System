# WikiCompare

Interactive system for comparative reading of two English Wikipedia articles.

## Local LLM Configuration

Set these environment variables before starting the backend:

```bash
export OPENAI_MODEL="gpt-5.5"
export OPENAI_BASE_URL="https://newapi.lxhei.xyz/v1"
export OPENAI_API_KEY="your-provider-key"
```

Do not commit API keys to the repository.

## Research Data and Privacy

This repository distributes the WikiCompare system, experiment implementation,
and reading materials. Participant-level study records are not part of the
public code distribution. Do not commit participant responses, questionnaire
answers, runtime sessions, or exported study datasets.

Runtime data belong in `wikitable-vue-experiment/server/experiment_data/`, which
is excluded from version control. The backend creates its required runtime
directories during initialization. Keep any study data and backups in private
storage outside this repository.

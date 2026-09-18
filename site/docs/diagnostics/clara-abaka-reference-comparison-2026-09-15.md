# Clara Abaka AI reference comparison

Baseline: live local browser run in Quick mode using an isolated SQLite database. Retrieval occurred at approximately `2026-09-16T04:54Z` (2026-09-15 Pacific time). No fixture or mocked provider result was used.

| Explicit public fact | Source and short excerpt | Source date | Clara discovered/fetched | Extracted as a fact | Shown in report | Earliest loss |
|---|---|---|---|---|---|---|
| Abaka offers data collection, data cleaning, and data annotation | [Official data-collection page](https://www.abaka.ai/services/data_collection): “data collection, data cleaning, data annotation” | Not stated; retrieved 2026-09-16 | Yes / yes | No; `products=[]`, `services=[]` | Only indirectly inside a generic source-description paragraph; not as a service fact | HTML extraction |
| The data-collection service is positioned as global and at scale | [Official data-collection page](https://www.abaka.ai/services/data_collection): “Global Data Collection at Scale” | Not stated; retrieved 2026-09-16 | Yes / yes | No | No | HTML extraction |
| Tom Tang is presented as CEO | [Official team page](https://www.abaka.ai/team): “Tom Tang CEO” | Not stated; retrieved 2026-09-16 | Yes / yes | No; `executives=[]` | No; leadership names Jack Lin only | HTML extraction |
| Abaka describes itself as a data and infrastructure partner for frontier AI labs | [Official team page](https://www.abaka.ai/team): “data and infrastructure partner for frontier AI labs” | Not stated; retrieved 2026-09-16 | Yes / yes | Retained only in raw page text | No | Normalization, after the raw fetch |
| Nine public roles were open in the Greenhouse feed at retrieval time | [Greenhouse job board](https://job-boards.greenhouse.io/abakaai/jobs/4056029009): public ATS records | Individual posting dates range from 2026-05-06 to 2026-09-09; retrieved 2026-09-16 | Yes / yes | Yes, 9 structured job records | Yes | Not lost |

Notes:

- The reference facts above remain separate from the baseline report. They were not injected into Clara.
- “Not shown” does not imply the fact is false; it describes the observed baseline output.
- Exact HTTP status codes and rejected per-URL SerpApi leads are unknown because the current provider result does not persist them.

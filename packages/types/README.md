# @aiscern/types

Shared TypeScript types/interfaces used by more than one app — e.g. the
shape of a scan result, which `frontend` (the detector itself) and `admin`
(the dashboard reading scan history) both need to agree on.

## Status: starter types only, not yet imported anywhere

`frontend/types/` and `admin` currently define their own versions of these
independently. This package exists so future shared types have a home;
migrating the *existing* duplicated definitions here (and updating every
import site) is Phase 2/3 work, not done in this pass.

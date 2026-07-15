// Preloaded via `node -r ./tests/setup.js` (see package.json's test script).
//
// Some app modules (e.g. src/utils/mailer.js) call require('dotenv').config()
// at load time, which — once any test file transitively requires them —
// pulls real values from the project's .env into process.env for the rest
// of that test run. Most of those don't affect test behavior, but
// DATA_ENCRYPTION_KEY does: it switches src/utils/json-store.js into
// encrypted mode, while several tests read/write data/*.json directly via
// raw fs (bypassing json-store) and expect plaintext. Pinning it to an empty
// string here runs before any of that, so dotenv sees the var as already set
// and leaves it alone — tests always run against plaintext data files.
process.env.DATA_ENCRYPTION_KEY = ''

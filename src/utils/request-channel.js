const ONLINE_REGISTRATION = 'online_registration'
const WALK_IN = 'walk_in'

function normalizeRequestChannel(value) {
  return value === WALK_IN ? WALK_IN : ONLINE_REGISTRATION
}

module.exports = {
  ONLINE_REGISTRATION,
  WALK_IN,
  normalizeRequestChannel,
}

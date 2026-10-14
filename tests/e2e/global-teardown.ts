import { restoreLaunchCampaign } from './helpers'

/** Put the launch campaign back to its real window after the run (local DB). */
export default async function globalTeardown() {
  await restoreLaunchCampaign()
}

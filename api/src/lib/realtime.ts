import { RedwoodGraphQLContext } from '@redwoodjs/graphql-server'
import {
  LiveQueryStorageMechanism,
  RedwoodRealtimeOptions,
} from '@redwoodjs/realtime'

import subscriptions from 'src/subscriptions/**/*.{js,ts}'

export const realtime: RedwoodRealtimeOptions = {
  subscriptions: {
    subscriptions,
    store: 'in-memory',
  },
  liveQueries: {
    store: 'in-memory',
  },
}

export interface RealtimeContext extends RedwoodGraphQLContext {
  liveQueryStore: LiveQueryStorageMechanism
}

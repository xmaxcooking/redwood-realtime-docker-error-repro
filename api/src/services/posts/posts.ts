import type { QueryResolvers, MutationResolvers } from 'types/graphql'

import { db } from 'src/lib/db'
import { RealtimeContext } from 'src/lib/realtime'

export const posts: QueryResolvers['posts'] = () => {
  return db.post.findMany()
}

export const post: QueryResolvers['post'] = ({ id }) => {
  return db.post.findUnique({
    where: { id },
  })
}

export const createPost: MutationResolvers<RealtimeContext>['createPost'] =
  async ({ input }, request) => {
    const created = await db.post.create({
      data: input,
    })
    invalidatePosts(request.context)
    return created
  }

export const updatePost: MutationResolvers<RealtimeContext>['updatePost'] =
  async ({ id, input }, request) => {
    const updated = await db.post.update({
      data: input,
      where: { id },
    })
    invalidatePost(id, request.context)
    return updated
  }

export const deletePost: MutationResolvers<RealtimeContext>['deletePost'] =
  async ({ id }, request) => {
    const deleted = await db.post.delete({
      where: { id },
    })
    invalidatePosts(request.context)
    return deleted
  }

const invalidatePost = (id: number, context: RealtimeContext) => {
  context?.liveQueryStore?.invalidate([`Post:${id}`, `Query.post(id:${id})`])
}

const invalidatePosts = (context: RealtimeContext) => {
  context?.liveQueryStore?.invalidate(['Query.posts'])
}

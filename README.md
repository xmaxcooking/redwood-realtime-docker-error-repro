# Realtime Docker Error - Reproduction

1.
```bash
yarn create redwood-app redwood-realtime-docker --typescript
cd redwood-realtime-docker
yarn redwood setup server-file
yarn redwood setup realtime
```

2.
Update the api/src/functions/graphql.ts file
```typescript
+ import { realtime } from 'src/lib/realtime'

  export const handler = createGraphQLHandler({
    // ...
+   realtime,
  })
```

3.
Update the api/src/lib/realtime.ts file
```typescript
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

+  export interface RealtimeContext extends RedwoodGraphQLContext {
+   liveQueryStore: LiveQueryStorageMechanism
+  }
```

4.
```bash
yarn redwood experimental setup-docker
```

5.
Update the api/db/schema.prisma file.
```prisma
  datasource db {
~   provider = "postgresql"
    url      = env("DATABASE_URL")
  }

  generator client {
    provider      = "prisma-client-js"
    binaryTargets = "native"
  }

+ model Post {
+   id        Int      @id @default(autoincrement())
+   title     String
+   body      String
+   createdAt DateTime @default(now())
+ }
```

6.
Start the docker compose once. Terminate and start the db container manually.
```bash
yarn docker compose -f ./docker-compose.dev.yml up
```

7.
Update the .env file.
```.env
~  DATABASE_URL=postgresql://redwood:redwood@localhost:5432/redwood
```

8.
Run the migration and scaffold.
```bash
yarn redwood prisma migrate dev
yarn redwood generate scaffold post
```

9. (Optional)
Update web/src/Routes.tsx to simplify route path.
```web/src/Routes.tsx
  const Routes = () => {
    return (
      <Router>
        <Set wrap={ScaffoldLayout} title="Posts" titleTo="posts" buttonLabel="New Post" buttonTo="newPost">
~         <Route path="/new" page={PostNewPostPage} name="newPost" />
~         <Route path="/{id:Int}/edit" page={PostEditPostPage} name="editPost" />
~         <Route path="/{id:Int}" page={PostPostPage} name="post" />
~         <Route path="/" page={PostPostsPage} name="posts" />
        </Set>
        <Route notfound page={NotFoundPage} />
      </Router>
    )
  }
```

10.
Update the api/src/services/posts/post.ts file.

```api/src/services/posts/posts.ts
  import type { QueryResolvers, MutationResolvers } from 'types/graphql'

  import { db } from 'src/lib/db'
+ import { RealtimeContext } from 'src/lib/realtime'

  export const posts: QueryResolvers['posts'] = () => {
    return db.post.findMany()
  }

  export const post: QueryResolvers['post'] = ({ id }) => {
    return db.post.findUnique({
      where: { id },
    })
  }

~ export const createPost: MutationResolvers<RealtimeContext>['createPost'] =
~   async ({ input }, request) => {
~     const created = await db.post.create({
~       data: input,
~     })
+     invalidatePosts(request.context)
~     return created
~   }

~ export const updatePost: MutationResolvers<RealtimeContext>['updatePost'] =
~   async ({ id, input }, request) => {
~     const updated = await db.post.update({
~       data: input,
~       where: { id },
~     })
+     invalidatePost(id, request.context)
~     return updated
~   }

~  export const deletePost: MutationResolvers<RealtimeContext>['deletePost'] =
~    async ({ id }, request) => {
~      const deleted = await db.post.delete({
~        where: { id },
~      })
+      invalidatePosts(request.context)
~      return deleted
~    }

+ const invalidatePost = (id: number, context: RealtimeContext) => {
+   if (!context) return
+   context?.liveQueryStore?.invalidate([`Post:${id}`, `Query.post(id:${id})`])
+ }
+
+ const invalidatePosts = (context: RealtimeContext) => {
+   if (!context) return
+   context?.liveQueryStore?.invalidate(['Query.posts'])
+ }
```

11.
Update the web queries with `@live`
in web/src/components/Post/EditPostCell.tsx, web/src/components/Post/PostCell/PostCell.tsx and web/src/components/Post/PostsCell/PostsCell.tsx
```typescript
  export const QUERY: TypedDocumentNode<EditPostById> = gql`
~    query EditPostById($id: Int!) @live {
      post: post(id: $id) {
        id
        title
        body
        createdAt
      }
    }
`
```

```typescript
  export const QUERY: TypedDocumentNode<
    FindPostById,
    FindPostByIdVariables
  > = gql`
~   query FindPostById($id: Int!) @live {
      post: post(id: $id) {
        id
        title
        body
        createdAt
      }
    }
`
```

```typescript
  export const QUERY: TypedDocumentNode<FindPosts, FindPostsVariables> = gql`
~   query FindPosts @live {
      posts {
        id
        title
        body
        createdAt
      }
    }
`
```

12.
Update the Dockerfile console target
```
  # console
  # -------
  FROM base as console

  # To add more packages:
  #
  # ```
  # USER root
  #
  # RUN apt-get update && apt-get install -y \
  #     curl
  #
  # USER node
  # ```

  COPY --chown=node:node api api
  COPY --chown=node:node web web
  COPY --chown=node:node scripts scripts

+ RUN yarn redwood prisma generate
```

13.
Update the docker-compose.prod.yml file.
```yaml
  version: "3.8"

  services:
    api:
      build:
        context: .
        dockerfile: ./Dockerfile
        target: api_serve
      ports:
        - "8911:8911"
      depends_on:
~       - init
      environment:
        - DATABASE_URL=postgresql://redwood:redwood@db:5432/redwood
        - TEST_DATABASE_URL=postgresql://redwood:redwood@db:5432/redwood_test
        - SESSION_SECRET=super_secret_session_key_change_me_in_production_please

    web:
      build:
        context: .
        dockerfile: ./Dockerfile
        target: web_serve
      ports:
        - "8910:8910"
      depends_on:
        - api
      environment:
        - API_PROXY_TARGET=http://api:8911

~    init:
~      build:
~        context: .
~        dockerfile: ./Dockerfile
~        target: console
~      command: >
~        sh -c "yarn redwood prisma migrate deploy"
~      depends_on:
~        - db
~      environment:
~        - DATABASE_URL=postgresql://redwood:redwood@db:5432/redwood

    db:
      image: postgres:16-bookworm
      environment:
        POSTGRES_USER: redwood
        POSTGRES_PASSWORD: redwood
        POSTGRES_DB: redwood
      ports:
        - "5432:5432"
      volumes:
        - ./postgres:/var/lib/postgresql/data
```

14.
Start the docker containers
```bash
docker compose -f ./docker-compose.prod.yml up
```

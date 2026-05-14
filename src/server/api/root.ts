import { projectSettingsRouter } from "~/server/api/routers/project-settings";
import { studyCardItemsRouter } from "~/server/api/routers/study-card-items";
import { studyCardPostsRouter } from "~/server/api/routers/study-card-posts";
import { studyCardSharesRouter } from "~/server/api/routers/study-card-shares";
import { studyCardsRouter } from "~/server/api/routers/study-cards";
import { createCallerFactory, createTRPCRouter } from "~/server/api/trpc";

/**
 * This is the primary router for your server.
 *
 * All routers added in /api/routers should be manually added here.
 */
export const appRouter = createTRPCRouter({
  studyCardItems: studyCardItemsRouter,
  studyCardPosts: studyCardPostsRouter,
  studyCards: studyCardsRouter,
  studyCardShares: studyCardSharesRouter,
  projectSettings: projectSettingsRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;

/**
 * Create a server-side caller for the tRPC API.
 * @example
 * const trpc = createCaller(createContext);
 * const res = await trpc.post.all();
 *       ^? Post[]
 */
export const createCaller = createCallerFactory(appRouter);

import { Context as BaseContext } from "@actions/github/lib/context"

export type Context = Omit<BaseContext, "issue"> & {
  issue?: BaseContext["issue"]
}

export function isIssueContext(context: Context): context is BaseContext {
  return "issue" in context && context.issue !== undefined
}

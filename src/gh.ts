import { Context as BaseContext } from "@actions/github/lib/context"

export type Context = Omit<BaseContext, "issue"> & {
  issue: Omit<BaseContext["issue"], "number"> & {
    number: number | undefined
  }
}

export function isIssueContext(context: Context): context is BaseContext {
  return context.issue.number !== undefined
}

import { useRef } from "react";
import {
  getFirstBuildReadiness,
  type FirstBuildReadiness,
} from "@/api/first-build";
import authStore from "@/store/auth";
import userStore from "@/store/user";
import { useApiResource } from "./use-api-resource";

export interface FirstBuildResource {
  signedIn: boolean;
  data?: FirstBuildReadiness;
  error?: Error;
  loading: boolean;
  refresh: () => void;
}

export function useFirstBuild(): FirstBuildResource {
  const auth = authStore.useState();
  const { userinfo } = userStore.useState();
  // Include cookie sessions; invalidate immediately on session/identity changes.
  // Use an opaque revision rather than putting a token into a resource key.
  const identity = `${auth.initialized}:${auth.accessToken}:${userinfo?.userId ?? ""}`;
  const session = useRef({ identity, revision: 0 });
  if (session.current.identity !== identity) {
    session.current = { identity, revision: session.current.revision + 1 };
  }
  const signedIn = auth.initialized && !!(auth.accessToken || userinfo?.userId);
  const resource = useApiResource(
    signedIn ? `first-build:${session.current.revision}` : null,
    getFirstBuildReadiness,
  );
  return { ...resource, signedIn };
}

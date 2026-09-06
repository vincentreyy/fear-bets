"use client";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ToastProvider";

// Replaces the old act(kind, payload, reason) mega-dispatcher from
// App.jsx: call a Server Action directly, toast the result, and refresh
// the current route's server data on success.
export function useServerAction() {
  const router = useRouter();
  const { say } = useToast();
  return async (actionFn, args, successMessage) => {
    let result;
    try {
      result = await actionFn(args);
    } catch (e) {
      result = { ok: false, error: e.message || "Something went wrong." };
    }
    if (!result?.ok) { say(result?.error || "That didn't work."); return result; }
    say(successMessage || "Done.");
    router.refresh();
    return result;
  };
}

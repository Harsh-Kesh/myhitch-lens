"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { Button } from "@/components/ui/Button";
import { removeBookmark, unfollowAuthor } from "./actions";

export function RemoveBookmarkButton({ articleId }: { articleId: string }) {
  const router = useRouter();
  const [isPending, start] = useTransition();
  return (
    <Button
      variant="secondary"
      size="sm"
      disabled={isPending}
      onClick={() => start(async () => { await removeBookmark(articleId); router.refresh(); })}
    >
      Remove
    </Button>
  );
}

export function UnfollowButton({ authorId }: { authorId: string }) {
  const router = useRouter();
  const [isPending, start] = useTransition();
  return (
    <Button
      variant="secondary"
      size="sm"
      disabled={isPending}
      onClick={() => start(async () => { await unfollowAuthor(authorId); router.refresh(); })}
    >
      Unfollow
    </Button>
  );
}

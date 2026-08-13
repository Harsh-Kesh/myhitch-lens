import { listReviewQueue } from "@/lib/articles";
import { EditorialBoard } from "./EditorialBoard";

/** Server component: the review queue is read from the database. */
export default async function EditorialPage() {
  const queue = await listReviewQueue();
  return <EditorialBoard queue={queue} />;
}

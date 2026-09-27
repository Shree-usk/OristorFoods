import type { BlogCommentData } from "@/types/blog";

export function BlogCommentList({ comments }: { comments: BlogCommentData[] }) {
  if (comments.length === 0) {
    return <p className="text-body text-charcoal/70">No comments yet — be the first to share your thoughts.</p>;
  }

  return (
    <ul className="flex flex-col gap-6">
      {comments.map((comment) => (
        <li key={comment.id} className="border-b border-input pb-4 last:border-b-0">
          <p className="text-small font-medium text-charcoal">{comment.authorName}</p>
          <p className="mt-1 text-body text-charcoal/80">{comment.body}</p>
        </li>
      ))}
    </ul>
  );
}

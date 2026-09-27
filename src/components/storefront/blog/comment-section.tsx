import { BlogCommentForm } from "@/components/storefront/blog/blog-comment-form";
import { BlogCommentList } from "@/components/storefront/blog/blog-comment-list";
import type { BlogCommentData } from "@/types/blog";

export function CommentSection({ postSlug, comments }: { postSlug: string; comments: BlogCommentData[] }) {
  return (
    <div className="mt-12">
      <h2 className="text-h3 font-heading text-charcoal">Comments</h2>
      <div className="mt-4">
        <BlogCommentList comments={comments} />
      </div>
      <div className="mt-8">
        <h3 className="text-h4 font-heading text-charcoal">Leave a comment</h3>
        <div className="mt-4">
          <BlogCommentForm postSlug={postSlug} />
        </div>
      </div>
    </div>
  );
}

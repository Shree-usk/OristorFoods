import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function PendingModerationCard({ data }: { data: { reviews: number; recipeReviews: number; blogComments: number } }) {
  const total = data.reviews + data.recipeReviews + data.blogComments;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Pending Moderation</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-h3 font-heading text-charcoal">{total}</p>
        <ul className="mt-1 text-small text-charcoal/70">
          <li>{data.reviews} product review{data.reviews === 1 ? "" : "s"}</li>
          <li>{data.recipeReviews} recipe review{data.recipeReviews === 1 ? "" : "s"}</li>
          <li>{data.blogComments} blog comment{data.blogComments === 1 ? "" : "s"}</li>
        </ul>
      </CardContent>
    </Card>
  );
}

import { redirect } from "next/navigation";

type CourseTournamentsPageProps = {
  params: Promise<{ courseId: string }>;
};

export default async function CourseTournamentsPage({ params }: CourseTournamentsPageProps) {
  const { courseId } = await params;
  redirect(`/tournaments?courseId=${encodeURIComponent(courseId)}`);
}

import { redirect } from "next/navigation";

type CourseRecordAliasPageProps = {
  params: Promise<{ recordId: string }>;
};

export default async function CourseRecordAliasPage({ params }: CourseRecordAliasPageProps) {
  const { recordId } = await params;
  redirect(`/course-records/${recordId}`);
}

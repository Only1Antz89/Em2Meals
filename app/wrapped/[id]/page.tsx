import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { readSharedWrapped } from "@/lib/server";
import { WrappedStoryView } from "@/components/wrapped/wrapped-story";
import { siteUrl } from "@/lib/site";

// Shared links read the live workspace on every visit, so a withdrawn link
// stops working straight away.
export const dynamic = "force-dynamic";

async function load(id: string) {
  try {
    return await readSharedWrapped(id);
  } catch (error) {
    console.error("Unable to load a shared Wrapped report", error);
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const story = await load((await params).id);
  return {
    title: story
      ? `${story.customer} · ${story.periodLabel} Wrapped | ${story.business}`
      : "Wrapped | Fork Goodness Baked",
    robots: { index: false, follow: false },
  };
}

export default async function SharedWrapped({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const story = await load(id);
  if (!story) notFound();
  return (
    <main>
      <WrappedStoryView story={story} shareUrl={`${siteUrl}/wrapped/${id}`} />
      <p className="sr-only">
        <Link href="/">Visit {story.business}</Link>
      </p>
    </main>
  );
}

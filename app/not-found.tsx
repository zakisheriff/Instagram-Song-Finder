import type { Metadata } from "next";
import { SubPage } from "@/components/SubPage";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: { absolute: `Page not found – ${site.name}` },
  robots: { index: false, follow: true },
};

export default function NotFound() {
  return (
    <SubPage
      title="This page isn't available"
      lead="The link may be broken, or the page may have been removed. You can still search for a song from the home page."
    >
      {null}
    </SubPage>
  );
}

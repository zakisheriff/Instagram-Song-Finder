"use client";

import { useEffect } from "react";

interface ErrorPageProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function ErrorPage({ error, reset }: ErrorPageProps) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main id="main" className="content prose">
      <h1 className="content__title">Something went wrong</h1>
      <p className="content__lead">
        The page couldn&apos;t be displayed. Try again, and if the problem continues, come back in
        a few minutes.
      </p>
      <button type="button" className="button button--primary subpage__back" onClick={reset}>
        Try again
      </button>
    </main>
  );
}

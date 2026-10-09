"use client";

import { useEffect, useState } from "react";
import { faqEntries } from "@/lib/content/faq";
import { FeedbackLinks } from "./FeedbackLinks";
import { ChevronIcon } from "./icons";

/**
 * Questions open and close one at a time with the same eased height animation
 * as the search results. Every answer is always in the HTML, so the content
 * stays readable by search engines; closed answers are only hidden visually.
 */
export function FaqSection() {
  const [openId, setOpenId] = useState<string | null>(null);

  // A link such as /#what-is-an-isrc opens that question.
  useEffect(() => {
    const openFromHash = () => {
      const id = decodeURIComponent(window.location.hash.slice(1));
      if (faqEntries.some((entry) => entry.id === id)) setOpenId(id);
    };
    const frame = requestAnimationFrame(openFromHash);
    window.addEventListener("hashchange", openFromHash);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("hashchange", openFromHash);
    };
  }, []);

  return (
    <section className="content content--screen content--top" id="faq" aria-labelledby="faq-title">
      <h2 className="content__title" id="faq-title">
        Frequently asked questions
      </h2>
      <div className="faq">
        {faqEntries.map((entry) => {
          const open = entry.id === openId;
          return (
            <article className={`faq__item${open ? " is-open" : ""}`} id={entry.id} key={entry.id}>
              <h3>
                <button
                  type="button"
                  className="faq__question"
                  aria-expanded={open}
                  aria-controls={`${entry.id}-answer`}
                  onClick={() => setOpenId(open ? null : entry.id)}
                >
                  <span>{entry.question}</span>
                  <ChevronIcon className="faq__chevron" size={18} />
                </button>
              </h3>
              <div className="faq__panel" id={`${entry.id}-answer`} inert={!open}>
                <div className="faq__panel-inner">
                  <div className="faq__answer">
                    {entry.answer.map((paragraph) => (
                      <p key={paragraph}>{paragraph}</p>
                    ))}
                  </div>
                </div>
              </div>
            </article>
          );
        })}
      </div>

      <div className="callout faq__more">
        <strong>Didn&apos;t find your answer?</strong>
        <p>
          Tell us what went wrong or which song you couldn&apos;t find, and we&apos;ll look into
          it.
        </p>
        <FeedbackLinks />
      </div>
    </section>
  );
}

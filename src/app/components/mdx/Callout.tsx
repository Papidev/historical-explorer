import type { PropsWithChildren } from "react";

type Props = PropsWithChildren<{
  title?: string;
}>;

export const Callout = ({ title, children }: Props) => (
  <section className="poi-callout">
    {title ? <p className="poi-callout-title">{title}</p> : null}
    {children}
  </section>
);

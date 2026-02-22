import type { ComponentPropsWithoutRef } from "react";

type Props = ComponentPropsWithoutRef<"a">;

export const MdxLink = ({ href, ...props }: Props) => {
  const isExternal = typeof href === "string" && /^https?:\/\//i.test(href);
  if (isExternal) {
    return <a href={href} target="_blank" rel="noopener noreferrer" {...props} />;
  }

  return <a href={href} {...props} />;
};

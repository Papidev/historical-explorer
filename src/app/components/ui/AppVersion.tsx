export const AppVersion = () =>
  process.env.APP_VERSION ? (
    <span
      aria-label={`Application version ${process.env.APP_VERSION}`}
      className="shrink-0 text-xs whitespace-nowrap text-zinc-500 tabular-nums"
    >
      v{process.env.APP_VERSION}
    </span>
  ) : null;

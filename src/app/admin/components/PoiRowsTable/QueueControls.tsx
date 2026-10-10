export const QueueControls = ({
  isRunning,
  isPausing,
  isPaused,
  isStopping,
  disabled,
  onPause,
  onResume,
  onStop,
}: {
  isRunning: boolean;
  isPausing: boolean;
  isPaused: boolean;
  isStopping: boolean;
  disabled: boolean;
  onPause: () => void;
  onResume: () => Promise<void>;
  onStop: () => Promise<void>;
}) =>
  isRunning || isPaused ? (
    <>
      <button
        type="button"
        disabled={isPausing || isStopping || (!isRunning && disabled)}
        onClick={() => (isRunning ? onPause() : void onResume())}
        className="cursor-pointer rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-800 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isStopping
          ? "Stopping current POI..."
          : isPausing
            ? "Pausing after current POI..."
            : isRunning
              ? "Pause queue"
              : "Resume queue"}
      </button>
      {isRunning ? (
        <button
          type="button"
          disabled={isPausing || isStopping}
          onClick={() => void onStop()}
          className="cursor-pointer rounded-md border border-red-300 bg-white px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Stop current POI
        </button>
      ) : null}
    </>
  ) : null;

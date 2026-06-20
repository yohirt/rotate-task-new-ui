import { formatDuration } from "../utils/sessionTracker";

function TaskWheel({ tasks, activeIndex, setActiveIndex, taskProgressById = {} }) {
  if (tasks.length === 0) {
    return null;
  }

  const angleStep = 360 / tasks.length;
  const getLayerIndex = (index) => {
    const visualAngle = (index - activeIndex + tasks.length) * angleStep;
    const normalizedAngle = visualAngle % 360;

    if (index === activeIndex) {
      return 30;
    }

    const radians = (normalizedAngle * Math.PI) / 180;
    const sidePriority = 1 - Math.abs(Math.cos(radians));

    return 10 + Math.round(sidePriority * 10);
  };

  return (
    <div className="task-wheel">
      <div
        className="wheel-rotator"
        style={{
          transform: `rotate(${-activeIndex * angleStep}deg)`,
        }}
      >
        {tasks.map((task, index) => {
          const angle = index * angleStep;
          const progress = taskProgressById[task.id] ?? {
            percent: 0,
            spentSeconds: 0,
            targetSeconds: 0,
          };

          return (
            <button
              key={task.id}
              className={`wheel-item ${
                index === activeIndex ? "active" : ""
              } ${task.done ? "done" : ""}`}
              style={{
                transform: `rotate(${angle}deg) translate(0, calc(-1 * var(--wheel-radius, 155px))) rotate(${-angle + activeIndex * angleStep}deg)`,
                "--task-progress": `${progress.percent}%`,
                zIndex: getLayerIndex(index),
              }}
              onClick={() => setActiveIndex(index)}
            >
              <span className="wheel-item-fill" aria-hidden="true"></span>
              <span className="task-number">
                {String(index + 1).padStart(2, "0")}
              </span>
              <span className="task-percent">{progress.percent}%</span>
              <span className="task-icon">{task.icon}</span>
              <strong>{task.title}</strong>
              <span className="task-time-progress">
                {formatDuration(progress.spentSeconds)} /{" "}
                {formatDuration(progress.targetSeconds)}
              </span>
            </button>
          );
        })}
      </div>

      <div className="wheel-center">
        <h1>{tasks[activeIndex].title}</h1>
        <p>{taskProgressById[tasks[activeIndex].id]?.percent ?? 0}% celu</p>
      </div>
    </div>
  );
}

export default TaskWheel;

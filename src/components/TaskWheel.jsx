import { formatDuration } from "../utils/sessionTracker";
import { getTaskColor } from "../utils/taskColors";

const polarToCartesian = (angle, radius) => {
  const angleInRadians = (angle * Math.PI) / 180;

  return {
    x: 50 + radius * Math.sin(angleInRadians),
    y: 50 - radius * Math.cos(angleInRadians),
  };
};

const describeSegment = (
  centerAngle,
  angleStep,
  outerRadius = 48,
  innerRadius = 19
) => {
  const gap = Math.min(3, angleStep * 0.16);
  const startAngle = centerAngle - angleStep / 2 + gap;
  const endAngle = centerAngle + angleStep / 2 - gap;
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;
  const outerStart = polarToCartesian(startAngle, outerRadius);
  const outerEnd = polarToCartesian(endAngle, outerRadius);
  const innerEnd = polarToCartesian(endAngle, innerRadius);
  const innerStart = polarToCartesian(startAngle, innerRadius);

  return [
    `M ${outerStart.x} ${outerStart.y}`,
    `A ${outerRadius} ${outerRadius} 0 ${largeArc} 1 ${outerEnd.x} ${outerEnd.y}`,
    `L ${innerEnd.x} ${innerEnd.y}`,
    `A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${innerStart.x} ${innerStart.y}`,
    "Z",
  ].join(" ");
};

const describeProgressSegment = (centerAngle, angleStep, percent) => {
  if (percent <= 0) {
    return "";
  }

  const innerRadius = 19;
  const outerRadius = 48;
  const progressRadius =
    innerRadius + (outerRadius - innerRadius) * Math.min(percent, 100) / 100;

  return describeSegment(centerAngle, angleStep, progressRadius, innerRadius);
};

function TaskWheel({ tasks, activeIndex, setActiveIndex, taskProgressById = {} }) {
  if (tasks.length === 0) {
    return null;
  }

  const angleStep = 360 / tasks.length;
  const taskColors = tasks.map((task, index) => getTaskColor(task, index));

  return (
    <div
      className="task-wheel"
      style={{
        "--task-count": tasks.length,
      }}
    >
      <div
        className="wheel-rotator"
        style={{
          transform: `rotate(${-activeIndex * angleStep}deg)`,
        }}
      >
        <svg className="wheel-segments" viewBox="0 0 100 100" aria-hidden="true">
          <circle className="wheel-outer-rim" cx="50" cy="50" r="49" />
          {tasks.map((task, index) => {
            const progress = taskProgressById[task.id] ?? { percent: 0 };
            const centerAngle = index * angleStep;

            return (
              <g
                key={task.id}
                className={index === activeIndex ? "active" : ""}
              >
                <path
                  className="segment-base"
                  d={describeSegment(centerAngle, angleStep)}
                  fill={taskColors[index]}
                />
                {progress.percent > 0 && (
                  <path
                    className="segment-progress"
                    d={describeProgressSegment(
                      centerAngle,
                      angleStep,
                      progress.percent
                    )}
                    fill={taskColors[index]}
                  />
                )}
              </g>
            );
          })}
          <circle className="wheel-inner-rim" cx="50" cy="50" r="19" />
          <rect className="wheel-handle" x="47.8" y="0.4" width="4.4" height="4.4" rx="1.2" />
        </svg>

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
            aria-label={`${task.title}: ${progress.percent}% celu, ${formatDuration(
              progress.spentSeconds
            )} z ${formatDuration(progress.targetSeconds)}`}
            title={`${task.title} - ${progress.percent}%`}
            style={{
              transform: `rotate(${angle}deg) translate(0, calc(-1 * var(--wheel-radius, 155px))) rotate(${-angle + activeIndex * angleStep}deg)`,
              "--task-progress": `${progress.percent}%`,
              "--item-color": taskColors[index],
              zIndex: index === activeIndex ? 30 : 20,
            }}
            onClick={() => setActiveIndex(index)}
          >
            <span className="wheel-item-fill" aria-hidden="true">
              <span style={{ height: `${progress.percent}%` }}></span>
            </span>
            <span className="task-icon">{task.icon}</span>
            <strong>{task.title}</strong>
            <span className="task-percent">{progress.percent}%</span>
            <span className="task-time-progress" aria-hidden="true">
              {formatDuration(progress.spentSeconds)} /{" "}
              {formatDuration(progress.targetSeconds)}
            </span>
          </button>
          );
        })}
      </div>

      <div className="wheel-center">
        <span className="play-symbol" aria-hidden="true"></span>
        <span className="center-progress" aria-hidden="true"></span>
        <h1>{tasks[activeIndex].title}</h1>
        <p>{taskProgressById[tasks[activeIndex].id]?.percent ?? 0}% celu</p>
      </div>
    </div>
  );
}

export default TaskWheel;
